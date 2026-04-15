import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type CreateEmployeePayload = {
  email?: string
  password?: string
  username?: string
  full_name?: string
  branch_id?: number
  status?: 'active' | 'inactive'
}

function normalizeText(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeEmail(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status)
}

function validatePayload(payload: CreateEmployeePayload) {
  const email = normalizeEmail(payload.email)
  const password = String(payload.password || '').trim()
  const username = normalizeText(payload.username).toLowerCase()
  const fullName = normalizeText(payload.full_name)
  const branchId = Number(payload.branch_id)
  const status = payload.status === 'inactive' ? 'inactive' : 'active'

  if (!email) {
    throw new Error('Email is required before creating this employee.')
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address for this employee.')
  }

  if (password.length < 8) {
    throw new Error('Temporary password must be at least 8 characters long.')
  }

  if (!username) {
    throw new Error('Username is required before creating this employee.')
  }

  if (!fullName) {
    throw new Error('Full name is required before creating this employee.')
  }

  if (!Number.isFinite(branchId) || branchId <= 0) {
    throw new Error('Employee accounts must be assigned to a valid branch.')
  }

  return {
    email,
    password,
    username,
    full_name: fullName,
    branch_id: branchId,
    status,
  }
}

function normalizeAuthAdminErrorMessage(message: string) {
  const normalizedMessage = message.trim().toLowerCase()

  if (
    normalizedMessage.includes('already been registered') ||
    normalizedMessage.includes('already registered') ||
    normalizedMessage.includes('user already registered')
  ) {
    return 'That email address already exists in Supabase Auth.'
  }

  if (normalizedMessage.includes('password')) {
    return message
  }

  return message || 'Unable to create this employee in Supabase Auth.'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey =
      Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return errorResponse(
        'Missing Supabase environment variables for the admin-create-user function.',
        500,
      )
    }

    const authorization = request.headers.get('Authorization')

    if (!authorization) {
      return errorResponse('Missing authorization header.', 401)
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const {
      data: { user: callerUser },
      error: callerError,
    } = await callerClient.auth.getUser()

    if (callerError || !callerUser) {
      return errorResponse('Your session could not be verified. Please sign in again.', 401)
    }

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('id, role_key, status')
      .eq('id', callerUser.id)
      .maybeSingle()

    if (callerProfileError) {
      return errorResponse(
        callerProfileError.message || 'Unable to verify the current admin profile.',
        500,
      )
    }

    if (
      !callerProfile ||
      callerProfile.role_key !== 'admin' ||
      callerProfile.status !== 'active'
    ) {
      return errorResponse('Only active admin accounts can create employee users.', 403)
    }

    let rawPayload: CreateEmployeePayload = {}

    try {
      rawPayload = await request.json()
    } catch {
      return errorResponse('Invalid JSON body.', 400)
    }

    const payload = validatePayload(rawPayload)

    const { data: existingProfiles, error: usernameLookupError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('username', payload.username)
      .limit(1)

    if (usernameLookupError) {
      return errorResponse(
        usernameLookupError.message || 'Unable to validate the employee username.',
        500,
      )
    }

    if ((existingProfiles || []).length > 0) {
      return errorResponse('That username already exists in Supabase.', 409)
    }

    const { data: branchRow, error: branchError } = await adminClient
      .from('branches')
      .select('id, name, code, status')
      .eq('id', payload.branch_id)
      .maybeSingle()

    if (branchError) {
      return errorResponse(
        branchError.message || 'Unable to verify the selected branch.',
        500,
      )
    }

    if (!branchRow) {
      return errorResponse('Select a valid branch before creating this employee.', 400)
    }

    if (branchRow.status !== 'active') {
      return errorResponse('Employee accounts can only be assigned to active branches.', 400)
    }

    const { data: createdUserData, error: createUserError } =
      await adminClient.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: {
          username: payload.username,
          full_name: payload.full_name,
        },
        app_metadata: {
          role_key: 'employee',
          branch_id: String(payload.branch_id),
          status: payload.status,
        },
      })

    if (createUserError || !createdUserData.user) {
      return errorResponse(
        normalizeAuthAdminErrorMessage(
          createUserError?.message || 'Unable to create this employee in Supabase Auth.',
        ),
        400,
      )
    }

    const createdUser = createdUserData.user

    const { data: profileRow, error: profileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: createdUser.id,
          username: payload.username,
          full_name: payload.full_name,
          role_key: 'employee',
          branch_id: payload.branch_id,
          status: payload.status,
        },
        {
          onConflict: 'id',
        },
      )
      .select(
        `
          id,
          username,
          full_name,
          role_key,
          branch_id,
          status,
          created_at,
          updated_at,
          branch:branches(id,name,code,status)
        `,
      )
      .single()

    if (profileError || !profileRow) {
      await adminClient.auth.admin.deleteUser(createdUser.id)

      return errorResponse(
        profileError?.message || 'The user was created, but the profile row could not be saved.',
        500,
      )
    }

    return jsonResponse(
      {
        profile: profileRow,
        auth_user_id: createdUser.id,
        email: createdUser.email,
      },
      201,
    )
  } catch (error) {
    console.error('admin-create-user failed:', error)

    return errorResponse(
      error instanceof Error
        ? error.message
        : 'Unexpected error while creating this employee.',
      500,
    )
  }
})
