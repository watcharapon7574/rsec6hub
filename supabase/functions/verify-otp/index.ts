import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Hard request timeout so a hung auth/DB call can't burn the 150s worker
// wall-clock limit and return WORKER_RESOURCE_LIMIT to the client.
const REQUEST_TIMEOUT_MS = 30_000

serve(async (req) => {
  console.log('🔐 Verify OTP Function called:', req.method, req.url)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const timeoutPromise = new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), REQUEST_TIMEOUT_MS)
  )

  try {
    return await Promise.race([handleVerifyOtp(req), timeoutPromise])
  } catch (err) {
    if ((err as Error)?.message === 'REQUEST_TIMEOUT') {
      console.error('⏱️ verify-otp request timeout after 30s')
      return new Response(
        JSON.stringify({ error: 'ระบบใช้เวลาประมวลผลนานเกินไป กรุณาลองใหม่อีกครั้ง' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    throw err
  }
})

async function handleVerifyOtp(req: Request): Promise<Response> {
  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { phone, otp } = await req.json()

    if (!phone || !otp) {
      return new Response(JSON.stringify({ error: 'Phone and OTP required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('📱 Verifying OTP for phone:', phone, 'OTP:', otp)

    // Normalize phone number for database lookup
    let normalizedPhone = phone.replace(/^\+66/, '0').replace(/\D/g, '')
    if (!normalizedPhone.startsWith('0') && normalizedPhone.length === 9) {
      normalizedPhone = '0' + normalizedPhone
    }
    const formattedPhone = phone.startsWith('+') ? phone : `+66${normalizedPhone.substring(1)}`

    // 1. ตรวจสอบ OTP ใน DB
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('otp_code', otp)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otpError) {
      console.error('❌ OTP lookup error:', otpError)
      return new Response(
        JSON.stringify({ error: 'เกิดข้อผิดพลาดในการตรวจสอบรหัส OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!otpRecord) {
      console.log('❌ OTP not found or invalid')
      return new Response(
        JSON.stringify({ error: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ OTP verified successfully')

    // 2. Get profile information
    // For admin phone (036776259), use telegram_chat_id to identify which admin
    // This allows multiple admins to share the same phone number with separate sessions
    const isAdminPhone = normalizedPhone === '036776259'
    let profile = null
    let profileError = null

    if (isAdminPhone && otpRecord.telegram_chat_id) {
      console.log('👤 Admin phone detected, looking up by telegram_chat_id:', otpRecord.telegram_chat_id)

      // For admin phone: find profile with matching telegram_chat_id AND is_admin = true
      // This prevents getting teacher profile when same person has both admin and teacher profiles
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('telegram_chat_id', String(otpRecord.telegram_chat_id))
        .eq('is_admin', true)
        .maybeSingle()

      profile = data
      profileError = error

      // If no profile found by telegram_chat_id for admin
      if (!profile && !profileError) {
        console.log('⚠️ No profile found by telegram_chat_id for admin, checking phone profile')

        // Check if there's a profile by phone that hasn't been claimed
        const { data: phoneData, error: phoneError } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('phone', normalizedPhone)
          .is('telegram_chat_id', null)
          .maybeSingle()

        if (phoneData && !phoneError) {
          // Found unclaimed profile - claim it
          console.log('✅ Found unclaimed admin profile, claiming it')
          profile = phoneData
          profileError = phoneError
        } else {
          // No unclaimed profile - need to create a new one for this admin
          console.log('🆕 Creating new admin profile for telegram_chat_id:', otpRecord.telegram_chat_id)

          // Get admin name from admin_otp_recipients
          const { data: recipient } = await supabaseAdmin
            .from('admin_otp_recipients')
            .select('recipient_name')
            .eq('telegram_chat_id', otpRecord.telegram_chat_id)
            .eq('is_active', true)
            .maybeSingle()

          const adminName = recipient?.recipient_name || 'Admin'
          const nameParts = adminName.split(' ')
          const firstName = nameParts[0] || 'Admin'
          const lastName = nameParts.slice(1).join(' ') || 'User'

          // Generate unique employee_id for new admin
          const timestamp = Date.now().toString(36).toUpperCase()
          const newEmployeeId = `ADMIN${timestamp}`
          const newEmail = `admin.${timestamp}@rsec6.temp`

          // First create auth user (without phone in metadata to avoid trigger issue)
          // The trigger handle_new_auth_user() tries to update ALL profiles with matching phone
          // which causes errors when multiple admins share the same phone
          // Phone is stored in profiles table instead
          const { data: newAuthData, error: newAuthError } = await supabaseAdmin.auth.admin.createUser({
            email: newEmail,
            email_confirm: true,
            user_metadata: {
              employee_id: newEmployeeId,
              first_name: firstName,
              last_name: lastName,
              position: 'director'
            }
          })

          if (newAuthError) {
            console.error('❌ Failed to create auth user for new admin:', newAuthError)
            return new Response(
              JSON.stringify({ error: 'ไม่สามารถสร้างบัญชี admin ใหม่ได้: ' + newAuthError.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          console.log('✅ Created new auth user for admin:', newAuthData.user.id)

          // Create new admin profile
          const { data: newProfile, error: newProfileError } = await supabaseAdmin
            .from('profiles')
            .insert({
              user_id: newAuthData.user.id,
              employee_id: newEmployeeId,
              first_name: firstName,
              last_name: lastName,
              phone: normalizedPhone,
              telegram_chat_id: String(otpRecord.telegram_chat_id),
              position: 'director',
              job_position: 'ผู้ดูแลระบบ',
              workplace: 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6',
              is_admin: true,
              email: newEmail
            })
            .select()
            .single()

          if (newProfileError) {
            console.error('❌ Failed to create new admin profile:', newProfileError)
            // Clean up: delete the auth user we just created
            await supabaseAdmin.auth.admin.deleteUser(newAuthData.user.id)
            return new Response(
              JSON.stringify({ error: 'ไม่สามารถสร้างโปรไฟล์ admin ใหม่ได้: ' + newProfileError.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          console.log('✅ Created new admin profile:', newProfile.employee_id)
          profile = newProfile
          profileError = null
        }
      }
    } else {
      // Normal user: lookup by phone
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('phone', normalizedPhone)
        .maybeSingle()

      profile = data
      profileError = error
    }

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError)
      return new Response(
        JSON.stringify({ error: 'ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาติดต่อผู้ดูแลระบบ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // อัปเดต telegram_chat_id ถ้ายังไม่มี (ผู้ใช้เข้าใช้งานครั้งแรก)
    if (!profile.telegram_chat_id && otpRecord.telegram_chat_id) {
      console.log('📝 First time login: updating telegram_chat_id for profile')
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ telegram_chat_id: otpRecord.telegram_chat_id })
        .eq('id', profile.id)

      if (updateError) {
        console.error('⚠️ Failed to update telegram_chat_id:', updateError)
      } else {
        profile.telegram_chat_id = otpRecord.telegram_chat_id
        console.log('✅ Updated profile with telegram_chat_id')
      }
    }

    let authUser = null
    let isNewUser = false

    // 3. ตรวจสอบว่ามี user ใน Supabase Auth แล้วหรือไม่
    if (profile.user_id) {
      console.log('👤 Getting existing auth user:', profile.user_id)
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.user_id)
      if (!userError && userData.user) {
        authUser = userData.user
        console.log('✅ Found existing auth user, email:', authUser.email)
        
        // ตรวจสอบว่า user มี email หรือไม่ ถ้าไม่มีให้เพิ่ม
        if (!authUser.email) {
          console.log('⚠️ User has no email, updating...')
          const tempEmail = `${profile.employee_id}@rsec6.temp`
          
          const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            authUser.id,
            {
              email: tempEmail,
              email_confirm: true
            }
          )
          
          if (updateError) {
            console.error('❌ Failed to update user email:', updateError)
          } else {
            authUser = updatedUser.user
            console.log('✅ Updated user with email:', authUser.email)
          }
        }
      } else {
        console.log('⚠️ Auth user not found, will create new one')
        profile.user_id = null
      }
    }

    // 4. ถ้ายังไม่มี → สร้าง user ใหม่ผ่าน admin API
    if (!authUser) {
      console.log('🆕 Creating new Supabase Auth user for phone:', formattedPhone)
      isNewUser = true
      
      // สร้าง user ด้วย email แทน phone เพื่อให้ทำงานได้ดีกว่า
      const tempEmail = `${profile.employee_id}@rsec6.temp`
      
      // Don't include phone in createUser to avoid trigger issues
      // The trigger handle_new_auth_user() causes problems when profiles share phone numbers
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: tempEmail,
        email_confirm: true,
        user_metadata: {
          employee_id: profile.employee_id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          position: profile.position
        }
      })

      if (authError) {
        console.error('❌ Failed to create auth user:', authError)
        return new Response(
          JSON.stringify({ error: 'ไม่สามารถสร้างบัญชีผู้ใช้ได้: ' + authError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      authUser = authData.user
      console.log('✅ Created new auth user:', authUser.id)

      // Update profile with new user_id
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ user_id: authUser.id })
        .eq('id', profile.id)

      if (updateError) {
        console.error('⚠️ Failed to update profile with user_id:', updateError)
      } else {
        console.log('✅ Updated profile with user_id')
      }
    }

    // 5. สร้าง session ด้วย generateLink + verifyOtp (ไม่ invalidate session เดิม)
    // วิธีนี้รองรับ multi-device login โดยไม่ทำให้อุปกรณ์เก่าหลุด session
    console.log('🔑 Creating session for user:', authUser.id)
    console.log('Using email:', authUser.email)

    // Generate magic link token (server-side, ไม่ invalidate session เดิม)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.email!,
    })

    if (linkError || !linkData) {
      console.error('❌ Failed to generate magic link:', linkError)
      return new Response(
        JSON.stringify({ error: 'ไม่สามารถสร้าง session ได้' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client to verify token and get session
    const clientSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Verify the token to get a proper session
    const { data: verifyData, error: verifyError } = await clientSupabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'email',
    })

    if (verifyError || !verifyData.session) {
      console.error('❌ Failed to verify magic link token:', verifyError)
      return new Response(
        JSON.stringify({ error: 'ไม่สามารถสร้าง access token ได้' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Session created successfully')

    // สร้าง session object
    const session = verifyData.session

    console.log('✅ Session object created')

    // Mark OTP as used
    await supabaseAdmin
      .from('otp_codes')
      .update({ is_used: true })
      .eq('id', otpRecord.id)

    // Log admin login if this is admin phone (036776259)
    if (normalizedPhone === '036776259') {
      console.log('📝 Logging admin login for phone:', normalizedPhone)

      // Get recipient name from admin_otp_recipients
      const { data: recipient } = await supabaseAdmin
        .from('admin_otp_recipients')
        .select('recipient_name')
        .eq('telegram_chat_id', otpRecord.telegram_chat_id)
        .eq('is_active', true)
        .maybeSingle()

      // Insert admin login log
      const { error: logError } = await supabaseAdmin
        .from('admin_login_logs')
        .insert({
          admin_phone: normalizedPhone,
          telegram_chat_id: otpRecord.telegram_chat_id,
          recipient_name: recipient?.recipient_name || 'Unknown',
          otp_code: otp,
          login_success: true,
          logged_in_at: new Date().toISOString()
        })

      if (logError) {
        console.error('⚠️ Failed to log admin login:', logError)
      } else {
        console.log('✅ Admin login logged successfully')
      }
    }

    console.log('🎉 Authentication completed successfully')

    // Return session data
    return new Response(
      JSON.stringify({
        success: true,
        session: session,
        profile: profile,
        isNewUser: isNewUser
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Error in verify-otp function:', error)
    return new Response(
      JSON.stringify({
        error: 'เกิดข้อผิดพลาดในระบบ',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}