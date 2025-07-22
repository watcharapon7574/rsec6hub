import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle()

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError)
      return new Response(
        JSON.stringify({ error: 'ไม่พบข้อมูลผู้ใช้' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: tempEmail,
        phone: formattedPhone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          phone: normalizedPhone,
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

    // 5. สร้าง session ด้วย signInWithPassword (สำหรับ server-side)
    console.log('🔑 Creating session for user:', authUser.id)
    console.log('Using email:', authUser.email)
    
    // สร้าง temporary password สำหรับ user (จะ reset ทันที)
    const tempPassword = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    // Update user password temporarily
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: tempPassword }
    )
    
    if (passwordError) {
      console.error('❌ Failed to set temporary password:', passwordError)
      return new Response(
        JSON.stringify({ error: 'ไม่สามารถสร้าง session ได้' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Create client for sign in
    const clientSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    
    // Sign in to get session
    const { data: signInData, error: signInError } = await clientSupabase.auth.signInWithPassword({
      email: authUser.email!,
      password: tempPassword
    })
    
    if (signInError || !signInData.session) {
      console.error('❌ Failed to sign in with temp password:', signInError)
      return new Response(
        JSON.stringify({ error: 'ไม่สามารถสร้าง access token ได้' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✅ Session created successfully')
    
    // สร้าง session object
    const session = signInData.session

    console.log('✅ Session object created')

    // Mark OTP as used
    await supabaseAdmin
      .from('otp_codes')
      .update({ is_used: true })
      .eq('id', otpRecord.id)

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
})