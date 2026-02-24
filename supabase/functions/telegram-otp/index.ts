// @ts-nocheck
// This file runs in Deno runtime (Supabase Edge Functions)
// TypeScript errors for Deno imports are expected in IDE but work at runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TelegramMessage {
  chat: {
    id: number
    type: string
  }
  from?: {
    id: number
    username?: string
    first_name?: string
  }
  text?: string
}

interface TelegramUpdate {
  message?: TelegramMessage
}

serve(async (req) => {
  console.log('🚀 Telegram OTP Function called:', req.method, req.url)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN not configured')
      throw new Error('TELEGRAM_BOT_TOKEN not configured')
    }

    const url = new URL(req.url)
    const action = url.pathname.split('/').pop()
    console.log('📍 Action:', action)

    // Handle both GET and POST requests
    let body = null;
    if (req.method === 'POST') {
      try {
        const contentType = req.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const text = await req.text();
          if (text.trim()) {
            body = JSON.parse(text);
          }
        }
      } catch (parseError) {
        console.log('⚠️ No JSON body or parse error:', parseError);
      }
      console.log('📥 Request body:', JSON.stringify(body, null, 2))
    }

    // Handle different actions
    switch (action) {
      case 'webhook': {
        if (req.method !== 'POST') {
          return new Response('Method not allowed', { 
            status: 405,
            headers: corsHeaders 
          })
        }
        
        console.log('🔔 Processing webhook request')
        // Handle Telegram webhook for user registration
        const update: TelegramUpdate = body
        console.log('📱 Telegram update:', JSON.stringify(update, null, 2))
        
        if (update?.message?.text?.startsWith('/start')) {
          console.log('⚡ Processing /start command')
          const chatId = update.message.chat.id
          const args = update.message.text.split(' ')
          console.log('💬 Chat ID:', chatId, 'Args:', args)
          
          if (args.length > 1) {
            // /start {phone} - link user to phone number
            const phone = args[1]
            console.log('📞 Linking phone:', phone)
            
            // Update profile with telegram_chat_id
            const { error } = await supabaseClient
              .from('profiles')
              .update({ telegram_chat_id: chatId })
              .eq('phone', phone)
            
            if (error) {
              console.error('❌ Database error:', error)
              await sendTelegramMessage(botToken, chatId, 
                'เกิดข้อผิดพลาดในการเชื่อมต่อบัญชี กรุณาลองใหม่อีกครั้ง')
            } else {
              console.log('✅ Successfully linked phone to Telegram')
              await sendTelegramMessage(botToken, chatId, 
                'เชื่อมต่อบัญชี Telegram สำเร็จแล้ว! ตั้งแต่นี้คุณจะได้รับรหัส OTP ผ่าน Telegram')
            }
          } else {
            console.log('🎉 Sending welcome message')
            await sendTelegramMessage(botToken, chatId, 
              'ยินดีต้อนรับสู่ RSEC6 OfficeHub! กรุณาสแกน QR Code จากแอปเพื่อเชื่อมต่อบัญชีของคุณ')
          }
        } else if (update?.message?.chat?.id) {
          console.log('ℹ️ Non-start message received:', update.message?.text)
          // Send a response for any other message
          await sendTelegramMessage(botToken, update.message.chat.id, 
            'สวัสดีครับ! กรุณาส่งคำสั่ง /start เพื่อเริ่มใช้งาน หรือสแกน QR Code จากแอป')
        }
        
        // Return success response for webhook
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'send-otp': {
        if (!body?.phone) {
          return new Response(JSON.stringify({ error: 'Phone number required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
          })
        }

        const { phone, telegram_chat_id: rawTelegramChatId } = body
        // Ensure telegram_chat_id is a number (database expects bigint)
        let telegram_chat_id: number | null = null
        if (rawTelegramChatId) {
          const parsed = Number(rawTelegramChatId)
          if (!isNaN(parsed)) {
            telegram_chat_id = parsed
          } else {
            console.error('❌ Invalid telegram_chat_id format:', rawTelegramChatId)
            return new Response(
              JSON.stringify({ error: 'Telegram Chat ID ไม่ถูกต้อง' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }
        }
        console.log('📱 telegram_chat_id from request:', rawTelegramChatId, '-> parsed:', telegram_chat_id)

        // Normalize phone number for database lookup
        // Convert +66925717574 to 0925717574 for database comparison
        let normalizedPhone = phone.replace(/^\+66/, '0').replace(/\D/g, '')
        if (!normalizedPhone.startsWith('0') && normalizedPhone.length === 9) {
          normalizedPhone = '0' + normalizedPhone
        }
        console.log('🔍 Looking up phone:', phone, '-> normalized:', normalizedPhone)

        // Check if this is admin phone - skip rate limiting for admin as they share the same phone
        const isAdminPhone = normalizedPhone === '036776259'

        // Check for rate limiting - max 3 OTP requests per 5 minutes
        // Skip rate limiting for admin phone since multiple admins share the same number
        if (!isAdminPhone) {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
          const { data: recentOtps, error: recentError } = await supabaseClient
            .from('otp_codes')
            .select('id')
            .eq('phone', normalizedPhone)
            .gte('created_at', fiveMinutesAgo.toISOString())

          if (recentError) {
            console.error('Error checking rate limit:', recentError)
          } else if (recentOtps && recentOtps.length >= 3) {
            return new Response(
              JSON.stringify({ error: 'กรุณารอ 5 นาทีก่อนขอรหัส OTP ใหม่' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
            )
          }
        } else {
          console.log('⏩ Skipping rate limit for admin phone')
        }

        // For admin phone, skip profile lookup since multiple admins share the same phone
        // Instead, we'll send OTP to all active recipients in admin_otp_recipients
        let profile = null
        let chatId = telegram_chat_id

        if (!isAdminPhone) {
          // Check if user exists and get telegram_chat_id (normal user flow)
          const { data: profileData, error: profileError } = await supabaseClient
            .from('profiles')
            .select('telegram_chat_id, first_name, last_name, user_id')
            .eq('phone', normalizedPhone)
            .maybeSingle()

          if (profileError) {
            console.error('Profile lookup error:', profileError)
            return new Response(
              JSON.stringify({ error: 'เกิดข้อผิดพลาดในการค้นหาข้อมูล' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            )
          }

          // ถ้าไม่พบ profile = เบอร์ไม่มีในระบบ (ติดต่อแอดมิน)
          if (!profileData) {
            return new Response(
              JSON.stringify({
                error: 'user_not_found',
                message: 'ไม่พบเบอร์โทรศัพท์นี้ในระบบ กรุณาติดต่อผู้ดูแลระบบ'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }

          // ถ้ามี profile แต่ไม่มี telegram_chat_id และไม่มีส่งมาด้วย = ผู้ใช้เข้าครั้งแรกต้องกรอก chat id
          if (profileData && !profileData.telegram_chat_id && !telegram_chat_id) {
            return new Response(
              JSON.stringify({
                error: 'need_telegram_chat_id',
                message: 'กรุณาใส่ Telegram Chat ID สำหรับการเข้าใช้งานครั้งแรก'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }

          profile = profileData
          // ใช้ telegram_chat_id จาก profile หรือจากที่ผู้ใช้ส่งมา (สำหรับผู้ใช้ใหม่)
          chatId = profile?.telegram_chat_id || telegram_chat_id
          console.log('🔑 Using chatId:', chatId, 'from profile:', !!profile?.telegram_chat_id)
        } else {
          console.log('👤 Admin phone detected, skipping profile lookup (multiple admins share same phone)')
        }

        // For admin phone, chatId is not required (we'll send to all recipients)
        if (!chatId && !isAdminPhone) {
          return new Response(
            JSON.stringify({
              error: 'telegram_chat_id_required',
              message: 'กรุณาใส่ Telegram Chat ID'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // Invalidate any existing unused OTPs for this phone
        await supabaseClient
          .from('otp_codes')
          .update({ is_used: true })
          .eq('phone', normalizedPhone)
          .eq('is_used', false)

        // Admin phone uses unique OTP per recipient
        if (isAdminPhone) {
          console.log('🔑 Admin login detected, generating unique OTP for each recipient')

          // Get all active admin OTP recipients
          const { data: adminRecipients, error: recipientsError } = await supabaseClient
            .from('admin_otp_recipients')
            .select('telegram_chat_id, recipient_name')
            .eq('admin_phone', normalizedPhone)
            .eq('is_active', true)

          if (recipientsError) {
            console.error('Failed to get admin recipients:', recipientsError)
            return new Response(
              JSON.stringify({ error: 'ไม่สามารถดึงรายชื่อ recipients ได้' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            )
          }

          if (!adminRecipients || adminRecipients.length === 0) {
            console.warn('⚠️ No active admin recipients found, falling back to profile chat_id')
            // Fallback: Generate single OTP for profile chat_id
            const otpCode = Math.floor(1000 + Math.random() * 9000).toString()
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

            const { error: otpError } = await supabaseClient
              .from('otp_codes')
              .insert({
                phone: normalizedPhone,
                otp_code: otpCode,
                telegram_chat_id: chatId,
                expires_at: expiresAt.toISOString()
              })

            if (otpError) {
              console.error('Failed to save OTP:', otpError)
              return new Response(
                JSON.stringify({ error: 'ไม่สามารถสร้างรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
              )
            }

            try {
              const adminMessage = `รหัสของคุณ: ${otpCode}\n\n🔐 OTP สำหรับเข้าสู่ระบบ Admin\n⏰ หมดอายุในอีก 5 นาที\n🔒 อย่าแชร์รหัสนี้กับผู้อื่น`
              await sendTelegramMessage(botToken, chatId, adminMessage)
              console.log('✅ OTP sent to profile chat_id')
            } catch (telegramError) {
              console.error('Failed to send Telegram message:', telegramError)
              return new Response(
                JSON.stringify({ error: 'ไม่สามารถส่งรหัส OTP ได้ กรุณาตรวจสอบ Telegram Chat ID' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
              )
            }
          } else {
            // Generate unique OTP for each recipient
            console.log(`🔐 Generating ${adminRecipients.length} unique OTPs for admin recipients`)
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

            const otpInserts = []
            const sendPromises = []

            for (const recipient of adminRecipients) {
              // Generate unique 4-digit OTP for this recipient
              const uniqueOtp = Math.floor(1000 + Math.random() * 9000).toString()

              // Prepare insert for database
              otpInserts.push({
                phone: normalizedPhone,
                otp_code: uniqueOtp,
                telegram_chat_id: recipient.telegram_chat_id,
                expires_at: expiresAt.toISOString()
              })

              // Prepare message for this recipient
              const adminMessage = `รหัสของคุณ: ${uniqueOtp}\n\n🔐 OTP สำหรับเข้าสู่ระบบ Admin (036776259)\n👤 เฉพาะสำหรับ: ${recipient.recipient_name}\n⏰ หมดอายุในอีก 5 นาที\n🔒 อย่าแชร์รหัสนี้กับผู้อื่น`

              // Add send promise
              sendPromises.push(
                sendTelegramMessage(botToken, recipient.telegram_chat_id, adminMessage)
                  .then(() => {
                    console.log(`✅ Unique OTP (${uniqueOtp}) sent to: ${recipient.recipient_name} (${recipient.telegram_chat_id})`)
                    return { success: true, recipient: recipient.recipient_name }
                  })
                  .catch((err) => {
                    console.error(`❌ Failed to send to ${recipient.recipient_name}:`, err)
                    return { success: false, recipient: recipient.recipient_name, error: err }
                  })
              )
            }

            // Insert all OTP records into database
            const { error: otpError } = await supabaseClient
              .from('otp_codes')
              .insert(otpInserts)

            if (otpError) {
              console.error('Failed to save OTPs:', otpError)
              return new Response(
                JSON.stringify({ error: 'ไม่สามารถสร้างรหัส OTP ได้' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
              )
            }

            console.log(`✅ Saved ${otpInserts.length} unique OTP records to database`)

            // Send all Telegram messages
            const results = await Promise.allSettled(sendPromises)
            const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length
            console.log(`📊 Unique OTPs sent to ${successCount}/${adminRecipients.length} recipients`)
          }
        } else {
          // Normal user - send single OTP to chat_id
          const otpCode = Math.floor(1000 + Math.random() * 9000).toString()
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

          // Save OTP to database
          const { error: otpError } = await supabaseClient
            .from('otp_codes')
            .insert({
              phone: normalizedPhone,
              otp_code: otpCode,
              telegram_chat_id: chatId,
              expires_at: expiresAt.toISOString()
            })

          if (otpError) {
            console.error('Failed to save OTP:', otpError)
            return new Response(
              JSON.stringify({ error: 'ไม่สามารถสร้างรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            )
          }

          const message = `รหัสของคุณ: ${otpCode}\n\n🔐 OTP สำหรับเข้าสู่ระบบ RSEC6 OfficeHub\n⏰ หมดอายุในอีก 5 นาที\n🔒 อย่าแชร์รหัสนี้กับผู้อื่น`

          try {
            await sendTelegramMessage(botToken, chatId, message)
            console.log('✅ OTP sent successfully to:', normalizedPhone)
          } catch (telegramError) {
            console.error('Failed to send Telegram message:', telegramError)
            return new Response(
              JSON.stringify({ error: 'ไม่สามารถส่งรหัส OTP ได้ กรุณาตรวจสอบ Telegram Chat ID' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            )
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'verify-otp': {
        if (!body?.phone || !body?.otp) {
          return new Response(JSON.stringify({ error: 'Phone and OTP required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
          })
        }
        
        const { phone, otp } = body
        
        // Normalize phone number for database lookup  
        // Convert +66925717574 to 0925717574 for database comparison
        let normalizedPhone = phone.replace(/^\+66/, '0').replace(/\D/g, '')
        if (!normalizedPhone.startsWith('0') && normalizedPhone.length === 9) {
          normalizedPhone = '0' + normalizedPhone
        }
        const formattedPhone = phone.startsWith('+') ? phone : `+66${normalizedPhone.substring(1)}`
        console.log('🔍 Verifying OTP for phone:', phone, '-> normalized:', normalizedPhone, 'OTP:', otp)

        // Debug: Check all OTPs for this phone
        const { data: allOtps, error: debugError } = await supabaseClient
          .from('otp_codes')
          .select('*')
          .eq('phone', normalizedPhone)
          .order('created_at', { ascending: false })
          .limit(5)

        if (!debugError && allOtps) {
          console.log('📋 Recent OTPs for phone:', normalizedPhone)
          allOtps.forEach((record, index) => {
            const isExpired = new Date(record.expires_at) < new Date()
            console.log(`  ${index + 1}. OTP: ${record.otp_code}, Used: ${record.is_used}, Expired: ${isExpired}, Created: ${record.created_at}`)
          })
        }

        // Find valid OTP in our system
        const { data: otpRecord, error: otpError } = await supabaseClient
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
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        console.log('🔎 OTP search result:', otpRecord ? 'Found' : 'Not found')
        if (!otpRecord) {
          // Check if OTP exists but is expired or used
          const { data: expiredOtp } = await supabaseClient
            .from('otp_codes')
            .select('*')
            .eq('phone', normalizedPhone)
            .eq('otp_code', otp)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (expiredOtp) {
            const isExpired = new Date(expiredOtp.expires_at) < new Date()
            console.log('⚠️ Found matching OTP but:', {
              used: expiredOtp.is_used,
              expired: isExpired,
              expiresAt: expiredOtp.expires_at
            })
            
            if (isExpired) {
              return new Response(
                JSON.stringify({ error: 'รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
              )
            } else if (expiredOtp.is_used) {
              return new Response(
                JSON.stringify({ error: 'รหัส OTP นี้ถูกใช้ไปแล้ว กรุณาขอรหัสใหม่' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
              )
            }
          }
          
          return new Response(
            JSON.stringify({ error: 'รหัส OTP ไม่ถูกต้อง' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        try {
          // Get profile to get user metadata
          const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('phone', normalizedPhone)
            .maybeSingle()

          if (profileError) {
            console.error('Profile lookup error:', profileError)
            throw new Error('Database error')
          }

          if (!profile) {
            throw new Error('Profile not found')
          }

          // If user doesn't exist in Supabase Auth yet, create them
          let authUser = null
          if (!profile.user_id) {
            console.log('Creating new Supabase Auth user for phone:', formattedPhone)
            
            // Create user with phone and metadata
            const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
              phone: formattedPhone,
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
              console.error('Failed to create auth user:', authError)
              throw new Error('Failed to create auth user')
            }

            authUser = authData.user
            console.log('Created new auth user:', authUser.id)

            // Update profile with new user_id
            const { error: updateError } = await supabaseClient
              .from('profiles')
              .update({ user_id: authUser.id })
              .eq('id', profile.id)

            if (updateError) {
              console.error('Failed to update profile with user_id:', updateError)
            }
          } else {
            // Get existing auth user
            const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(profile.user_id)
            if (!userError && userData.user) {
              authUser = userData.user
            }
          }

          // Mark OTP as used
          await supabaseClient
            .from('otp_codes')
            .update({ is_used: true })
            .eq('id', otpRecord.id)

          // Return success with user information for session creation
          return new Response(
            JSON.stringify({ 
              success: true,
              user: authUser,
              profile: profile
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          console.error('Error in OTP verification:', error)
          return new Response(
            JSON.stringify({ error: 'Authentication failed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }
      }

      case 'get-bot-info': {
        try {
          const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
          const botInfo = await response.json()
          
          return new Response(
            JSON.stringify({ botInfo }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to get bot info' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }
      }

      case 'set-webhook': {
        try {
          console.log('🔧 Setting up Telegram webhook')
          const webhookUrl = `https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/telegram-otp/webhook`
          
          const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: webhookUrl,
              allowed_updates: ['message']
            })
          })

          const result = await response.json()
          console.log('📡 Webhook setup result:', result)
          
          return new Response(
            JSON.stringify({ result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          console.error('❌ Failed to set webhook:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to set webhook' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }
      }

      case 'get-webhook-info': {
        try {
          console.log('📋 Getting webhook info')
          const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
          const webhookInfo = await response.json()
          console.log('📡 Current webhook info:', webhookInfo)
          
          return new Response(
            JSON.stringify({ webhookInfo }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          console.error('❌ Failed to get webhook info:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to get webhook info' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }
      }

      case 'test-message': {
        if (!body?.chatId || !body?.message) {
          return new Response(JSON.stringify({ error: 'Chat ID and message required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
          })
        }
        
        try {
          console.log('📤 Sending test message to chat:', body.chatId)
          await sendTelegramMessage(botToken, body.chatId, body.message)
          
          return new Response(
            JSON.stringify({ success: true, message: 'Message sent successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          console.error('❌ Failed to send test message:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to send message' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }
      }

      default: {
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )

  } catch (error) {
    console.error('❌ Unhandled error:', error)
    const err = error as Error
    console.error('Error stack:', err.stack)
    console.error('Error name:', err.name)
    console.error('Error message:', err.message)
    return new Response(
      JSON.stringify({
        error: err.message || 'Internal server error',
        details: err.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Telegram API error:', error)
    throw new Error('Failed to send Telegram message')
  }

  return response.json()
}