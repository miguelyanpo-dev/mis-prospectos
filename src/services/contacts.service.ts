import type { Pool } from 'pg';
import { NotFoundError } from '../utils/errors';
import type { CreateContactInput, UpdateContactInput, ContactType } from '../schemas/contacts.schemas';

// ─── Mapeo de tipo → columna de filtro ───────────────────────────────────────

const TYPE_COLUMN: Record<ContactType, string> = {
  seller:   'c.is_seller',
  customer: 'c.is_customer',
  supplier: 'c.is_supplier',
  employee: 'c.is_employee',
  prospect: 'c.is_prospect',
};

// ─── Query base: LEFT JOIN contacts + sellers ─────────────────────────────────

const BASE_SELECT = `
  SELECT
    c.id_contact,
    c.contact_name,
    c.identification,
    c.company_name,
    c.phone_mobile,
    c.email,
    c.is_seller,
    c.is_customer,
    c.is_supplier,
    c.is_employee,
    c.is_in_external_software,
    c.is_prospect,
    c.is_in_my_followups,
    c.is_in_reassigned,
    c.is_excluded,
    c.is_blacklisted,
    c.address_billing_line,
    c.address_billing_region,
    c.address_billing_city,
    c.id_seller,
    c.id_status_customer,
    c.id_status_prospect,
    c.id_status_supplier,
    c.id_status_employee,
    c.id_status_seller,
    c.created_at,
    c.created_by_user_id,
    c.updated_at,
    c.updated_by_user_id,
    s.id_seller  AS seller_id,
    s.seller_code,
    s.is_active  AS seller_is_active
  FROM contacts c
  LEFT JOIN sellers s
    ON s.id_contact = c.id_contact
   AND s.deleted_at IS NULL
  WHERE c.deleted_at IS NULL
`;

// ─── GET lista paginada ───────────────────────────────────────────────────────

export async function getContacts(
  db: Pool,
  page: number,
  limit: number,
  search?: string,
  type?: ContactType
) {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (search) {
    conditions.push(`(
      c.contact_name    ILIKE $${i}
      OR c.identification ILIKE $${i}
      OR c.email          ILIKE $${i}
      OR c.company_name   ILIKE $${i}
    )`);
    values.push(`%${search}%`);
    i++;
  }

  if (type) {
    conditions.push(`${TYPE_COLUMN[type]} = true`);
  }

  const extraWhere = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';

  const countQuery = `
    SELECT COUNT(*) FROM contacts c
    WHERE c.deleted_at IS NULL${extraWhere}
  `;

  const dataQuery = `
    ${BASE_SELECT}${extraWhere}
    ORDER BY c.created_at DESC
    LIMIT $${i} OFFSET $${i + 1}
  `;

  const [countResult, dataResult] = await Promise.all([
    db.query(countQuery, values),
    db.query(dataQuery, [...values, limit, offset]),
  ]);

  return {
    data: dataResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
}

// ─── GET por id ───────────────────────────────────────────────────────────────

export async function getContactById(db: Pool, id_contact: number) {
  const result = await db.query(
    `${BASE_SELECT} AND c.id_contact = $1`,
    [id_contact]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(`Contact with id ${id_contact} not found`);
  }

  return result.rows[0];
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createContact(db: Pool, input: CreateContactInput) {
  const isSeller = input.is_seller === true;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Insertar contacto
    const contactResult = await client.query(
      `INSERT INTO contacts (
        contact_name, identification, company_name, phone_mobile, email,
        is_seller, is_customer, is_supplier, is_employee, is_in_external_software,
        is_prospect,
        address_billing_line, address_billing_region, address_billing_city,
        id_status_customer, id_status_prospect, id_status_supplier,
        id_status_employee, id_status_seller,
        created_at, created_by_user_id
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11,
        $12, $13, $14,
        $15, $16, $17, $18, $19,
        NOW(), $20
      ) RETURNING id_contact`,
      [
        input.contact_name,
        input.identification          ?? null,
        input.company_name            ?? null,
        input.phone_mobile            ?? null,
        input.email                   ?? null,
        input.is_seller               ?? false,
        input.is_customer             ?? false,
        input.is_supplier             ?? false,
        input.is_employee             ?? false,
        input.is_in_external_software ?? false,
        input.is_prospect             ?? false,
        input.address_billing_line    ?? null,
        input.address_billing_region  ?? null,
        input.address_billing_city    ?? null,
        input.id_status_customer      ?? null,
        input.id_status_prospect      ?? null,
        input.id_status_supplier      ?? null,
        input.id_status_employee      ?? null,
        input.id_status_seller        ?? null,
        input.created_by_user_id      ?? null,
      ]
    );

    const id_contact: number = contactResult.rows[0].id_contact;

    // 2. Si es vendedor, crear registro en sellers
    if (isSeller) {
      await client.query(
        `INSERT INTO sellers (id_contact, seller_code, is_active, created_at, created_by_user_id)
         VALUES ($1, $2, $3, NOW(), $4)`,
        [
          id_contact,
          input.seller_code       ?? null,
          input.seller_is_active  ?? true,
          input.created_by_user_id ?? null,
        ]
      );
    }

    await client.query('COMMIT');

    return getContactById(db, id_contact);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateContact(
  db: Pool,
  id_contact: number,
  input: UpdateContactInput
) {
  // Verificar que existe
  const existing = await db.query(
    `SELECT c.id_contact, c.is_seller, s.id_seller
     FROM contacts c
     LEFT JOIN sellers s ON s.id_contact = c.id_contact AND s.deleted_at IS NULL
     WHERE c.id_contact = $1 AND c.deleted_at IS NULL`,
    [id_contact]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError(`Contact with id ${id_contact} not found`);
  }

  const { is_seller: was_seller, id_seller: existing_seller_id } = existing.rows[0];
  const becomes_seller = input.is_seller === true && !was_seller;

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Campos actualizables de contacts
    const contactFields: (keyof UpdateContactInput)[] = [
      'contact_name', 'identification', 'company_name', 'phone_mobile', 'email',
      'is_seller', 'is_customer', 'is_supplier', 'is_employee',
      'is_in_external_software', 'is_prospect', 'is_in_my_followups',
      'is_in_reassigned', 'is_excluded', 'is_blacklisted',
      'address_billing_line', 'address_billing_region', 'address_billing_city',
      'id_status_customer', 'id_status_prospect', 'id_status_supplier',
      'id_status_employee', 'id_status_seller',
    ];

    const contactUpdates: string[] = [];
    const contactValues: any[] = [];
    let ci = 1;

    for (const field of contactFields) {
      if (input[field] !== undefined) {
        contactUpdates.push(`${field} = $${ci++}`);
        contactValues.push(input[field]);
      }
    }

    if (contactUpdates.length > 0) {
      contactUpdates.push(`updated_at = NOW()`);
      if (input.updated_by_user_id !== undefined) {
        contactUpdates.push(`updated_by_user_id = $${ci++}`);
        contactValues.push(input.updated_by_user_id);
      }
      contactValues.push(id_contact);
      await client.query(
        `UPDATE contacts SET ${contactUpdates.join(', ')} WHERE id_contact = $${ci}`,
        contactValues
      );
    }

    // Si ya tenía registro en sellers → actualizar campos del vendedor
    if (existing_seller_id && (input.seller_code !== undefined || input.seller_is_active !== undefined)) {
      const sellerUpdates: string[] = [];
      const sellerValues: any[] = [];
      let si = 1;

      if (input.seller_code !== undefined) {
        sellerUpdates.push(`seller_code = $${si++}`);
        sellerValues.push(input.seller_code);
      }
      if (input.seller_is_active !== undefined) {
        sellerUpdates.push(`is_active = $${si++}`);
        sellerValues.push(input.seller_is_active);
      }

      sellerUpdates.push(`updated_at = NOW()`);
      if (input.updated_by_user_id !== undefined) {
        sellerUpdates.push(`updated_by_user_id = $${si++}`);
        sellerValues.push(input.updated_by_user_id);
      }

      sellerValues.push(existing_seller_id);
      await client.query(
        `UPDATE sellers SET ${sellerUpdates.join(', ')} WHERE id_seller = $${si}`,
        sellerValues
      );
    }

    // Si se está activando is_seller por primera vez → crear registro en sellers
    if (becomes_seller) {
      await client.query(
        `INSERT INTO sellers (id_contact, seller_code, is_active, created_at, created_by_user_id)
         VALUES ($1, $2, $3, NOW(), $4)`,
        [
          id_contact,
          input.seller_code       ?? null,
          input.seller_is_active  ?? true,
          input.updated_by_user_id ?? null,
        ]
      );
    }

    await client.query('COMMIT');

    return getContactById(db, id_contact);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── DELETE (soft) ────────────────────────────────────────────────────────────

export async function deleteContact(
  db: Pool,
  id_contact: number,
  deleted_by_user_id?: number
) {
  const existing = await db.query(
    `SELECT c.id_contact, s.id_seller
     FROM contacts c
     LEFT JOIN sellers s ON s.id_contact = c.id_contact AND s.deleted_at IS NULL
     WHERE c.id_contact = $1 AND c.deleted_at IS NULL`,
    [id_contact]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError(`Contact with id ${id_contact} not found`);
  }

  const { id_seller } = existing.rows[0];
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE contacts SET deleted_at = NOW(), deleted_by_user_id = $1 WHERE id_contact = $2`,
      [deleted_by_user_id ?? null, id_contact]
    );

    // Si tiene registro en sellers, también eliminarlo
    if (id_seller) {
      await client.query(
        `UPDATE sellers SET deleted_at = NOW(), deleted_by_user_id = $1 WHERE id_seller = $2`,
        [deleted_by_user_id ?? null, id_seller]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
