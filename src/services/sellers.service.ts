import type { Pool } from 'pg';
import { NotFoundError } from '../utils/errors';
import type { CreateSellerInput, UpdateSellerInput } from '../schemas/sellers.schemas';

// ─── Query base: JOIN sellers + contacts ─────────────────────────────────────

const BASE_SELECT = `
  SELECT
    s.id_seller,
    s.id_contact,
    s.seller_code,
    s.is_active,
    c.contact_name,
    c.identification,
    c.company_name,
    c.phone_mobile,
    c.email,
    c.address_billing_line,
    c.address_billing_region,
    c.address_billing_city,
    c.is_customer,
    c.is_supplier,
    c.is_employee,
    c.is_in_external_software,
    c.is_prospect,
    c.is_excluded,
    c.is_blacklisted,
    s.created_at,
    s.updated_at
  FROM sellers s
  INNER JOIN contacts c ON c.id_contact = s.id_contact
  WHERE s.deleted_at IS NULL
    AND c.deleted_at IS NULL
`;

// ─── GET lista paginada ───────────────────────────────────────────────────────

export async function getSellers(
  db: Pool,
  page: number,
  limit: number,
  search?: string,
  is_active?: boolean
) {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (search) {
    conditions.push(`(
      c.contact_name ILIKE $${i}
      OR c.identification ILIKE $${i}
      OR c.email ILIKE $${i}
      OR s.seller_code ILIKE $${i}
    )`);
    values.push(`%${search}%`);
    i++;
  }

  if (is_active !== undefined) {
    conditions.push(`s.is_active = $${i}`);
    values.push(is_active);
    i++;
  }

  const extraWhere = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';

  const countQuery = `
    SELECT COUNT(*) FROM sellers s
    INNER JOIN contacts c ON c.id_contact = s.id_contact
    WHERE s.deleted_at IS NULL AND c.deleted_at IS NULL${extraWhere}
  `;

  const dataQuery = `
    ${BASE_SELECT}${extraWhere}
    ORDER BY s.created_at DESC
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

export async function getSellerById(db: Pool, id_seller: number) {
  const result = await db.query(
    `${BASE_SELECT} AND s.id_seller = $1`,
    [id_seller]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(`Seller with id ${id_seller} not found`);
  }

  return result.rows[0];
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createSeller(db: Pool, input: CreateSellerInput) {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Insertar en contacts (is_seller = true siempre)
    const contactResult = await client.query(
      `INSERT INTO contacts (
        contact_name, identification, company_name, phone_mobile, email,
        is_seller, is_customer, is_supplier, is_employee, is_in_external_software,
        address_billing_line, address_billing_region, address_billing_city,
        created_at, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
      RETURNING id_contact`,
      [
        input.contact_name,
        input.identification ?? null,
        input.company_name ?? null,
        input.phone_mobile ?? null,
        input.email ?? null,
        input.is_customer ?? false,
        input.is_supplier ?? false,
        input.is_employee ?? false,
        input.is_in_external_software ?? false,
        input.address_billing_line ?? null,
        input.address_billing_region ?? null,
        input.address_billing_city ?? null,
        input.created_by_user_id ?? null,
      ]
    );

    const id_contact: number = contactResult.rows[0].id_contact;

    // 2. Insertar en sellers
    const sellerResult = await client.query(
      `INSERT INTO sellers (id_contact, seller_code, is_active, created_at, created_by_user_id)
       VALUES ($1, $2, $3, NOW(), $4)
       RETURNING id_seller`,
      [
        id_contact,
        input.seller_code ?? null,
        input.is_active ?? true,
        input.created_by_user_id ?? null,
      ]
    );

    const id_seller: number = sellerResult.rows[0].id_seller;

    await client.query('COMMIT');

    return getSellerById(db, id_seller);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateSeller(db: Pool, id_seller: number, input: UpdateSellerInput) {
  const existing = await db.query(
    'SELECT s.id_contact FROM sellers s WHERE s.id_seller = $1 AND s.deleted_at IS NULL',
    [id_seller]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError(`Seller with id ${id_seller} not found`);
  }

  const id_contact: number = existing.rows[0].id_contact;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Actualizar contacts
    const contactFields: (keyof UpdateSellerInput)[] = [
      'contact_name', 'identification', 'company_name', 'phone_mobile', 'email',
      'address_billing_line', 'address_billing_region', 'address_billing_city',
      'is_customer', 'is_supplier', 'is_employee', 'is_in_external_software',
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

    // Actualizar sellers
    const sellerUpdates: string[] = [];
    const sellerValues: any[] = [];
    let si = 1;

    if (input.seller_code !== undefined) {
      sellerUpdates.push(`seller_code = $${si++}`);
      sellerValues.push(input.seller_code);
    }
    if (input.is_active !== undefined) {
      sellerUpdates.push(`is_active = $${si++}`);
      sellerValues.push(input.is_active);
    }

    if (sellerUpdates.length > 0) {
      sellerUpdates.push(`updated_at = NOW()`);
      if (input.updated_by_user_id !== undefined) {
        sellerUpdates.push(`updated_by_user_id = $${si++}`);
        sellerValues.push(input.updated_by_user_id);
      }
      sellerValues.push(id_seller);
      await client.query(
        `UPDATE sellers SET ${sellerUpdates.join(', ')} WHERE id_seller = $${si}`,
        sellerValues
      );
    }

    await client.query('COMMIT');

    return getSellerById(db, id_seller);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── DELETE (soft) ────────────────────────────────────────────────────────────

export async function deleteSeller(
  db: Pool,
  id_seller: number,
  deleted_by_user_id?: number
) {
  const existing = await db.query(
    'SELECT id_contact FROM sellers WHERE id_seller = $1 AND deleted_at IS NULL',
    [id_seller]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError(`Seller with id ${id_seller} not found`);
  }

  const id_contact: number = existing.rows[0].id_contact;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE sellers SET deleted_at = NOW(), deleted_by_user_id = $1 WHERE id_seller = $2`,
      [deleted_by_user_id ?? null, id_seller]
    );

    await client.query(
      `UPDATE contacts SET deleted_at = NOW(), deleted_by_user_id = $1 WHERE id_contact = $2`,
      [deleted_by_user_id ?? null, id_contact]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
