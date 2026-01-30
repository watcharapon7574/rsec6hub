// Telegram Notification Edge Function
// This function sends notifications to Telegram when documents are created, approved, or rejected

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  type: 'document_pending' | 'document_approved' | 'document_rejected' | 'document_ready' | 'document_created' | 'document_completed_clerk' | 'task_assigned'
  document_id: string
  document_type: 'memo' | 'doc_receive'
  subject: string
  author_name: string
  requester_name?: string
  current_signer_name?: string
  current_signer_position?: string
  reject_reason?: string
  doc_number?: string
  urgency?: string
  assigned_by?: string // For task_assigned: name of person who assigned
  note?: string // For task_assigned: assignment note
  chat_id?: string // Optional: specific chat to send to
}

async function sendTelegramMessage(botToken: string, chatId: string, message: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Telegram API error: ${response.status} - ${errorText}`)
  }

  return await response.json()
}

function formatMessage(payload: NotificationPayload): string {
  const emoji = {
    document_pending: '📝',
    document_approved: '✅',
    document_rejected: '❌',
    document_ready: '📋',
    document_created: '🆕',
    document_completed_clerk: '✅',
    task_assigned: '📋',
  }

  const icon = emoji[payload.type] || '📄'

  let message = `${icon} <b>แจ้งเตือนเอกสาร</b>\n\n`

  switch (payload.type) {
    case 'document_pending':
      message += `<b>เอกสารใหม่รอการพิจารณา</b>\n`
      message += `เรื่อง: ${payload.subject}\n`
      message += `ผู้สร้าง: ${payload.author_name}\n`
      if (payload.current_signer_name) {
        message += `รอการพิจารณาจาก: ${payload.current_signer_name}\n`
        if (payload.current_signer_position) {
          message += `ตำแหน่ง: ${payload.current_signer_position}\n`
        }
      }
      message += `\nกรุณาเข้าระบบเพื่อพิจารณาเอกสาร`
      break

    case 'document_approved':
      message += `<b>เอกสารได้รับการอนุมัติแล้ว</b>\n`
      message += `เรื่อง: ${payload.subject}\n`
      message += `ผู้สร้าง: ${payload.author_name}\n`
      if (payload.doc_number) {
        message += `เลขที่หนังสือ: ${payload.doc_number}\n`
      }
      message += `\nเอกสารผ่านการอนุมัติเรียบร้อยแล้ว`
      break

    case 'document_rejected':
      message += `<b>เอกสารถูกปฏิเสธ</b>\n`
      message += `เรื่อง: ${payload.subject}\n`
      message += `ผู้สร้าง: ${payload.author_name}\n`
      if (payload.reject_reason) {
        message += `เหตุผล: ${payload.reject_reason}\n`
      }
      message += `\nกรุณาตรวจสอบและแก้ไขเอกสาร`
      break

    case 'document_completed_clerk':
      message += `<b>เอกสารเสร็จสิ้นแล้ว</b>\n`
      message += `เรื่อง: ${payload.subject}\n`
      message += `ผู้สร้าง: ${payload.author_name}\n`
      if (payload.doc_number) {
        message += `เลขที่หนังสือ: ${payload.doc_number}\n`
      }
      message += `\nเอกสารได้รับการอนุมัติเรียบร้อยแล้ว`
      break

    case 'document_ready':
      message += `<b>เอกสารพร้อมใช้งาน</b>\n`
      message += `เรื่อง: ${payload.subject}\n`
      if (payload.doc_number) {
        message += `เลขที่หนังสือ: ${payload.doc_number}\n`
      }
      message += `\nธุรการได้จัดเตรียมเอกสารเรียบร้อยแล้ว`
      break

    case 'document_created':
      message += `<b>มีเอกสารใหม่รอจัดการ</b>\n`
      message += `เรื่อง: ${payload.subject}\n`
      message += `ผู้สร้าง: ${payload.author_name}\n`
      if (payload.urgency) {
        const urgencyText = payload.urgency === 'high' ? '⚠️ เร่งด่วน' :
                           payload.urgency === 'medium' ? 'ปานกลาง' :
                           'ไม่เร่งด่วน'
        message += `ความเร่งด่วน: ${urgencyText}\n`
      }
      message += `\n💼 กรุณาเข้าระบบเพื่อจัดการเอกสาร`
      break

    case 'task_assigned':
      message += `<b>มีงานใหม่มอบหมายให้คุณ</b>\n`
      message += `เรื่อง: ${payload.subject}\n`
      if (payload.doc_number) {
        message += `เลขที่หนังสือ: ${payload.doc_number}\n`
      }
      if (payload.assigned_by) {
        message += `มอบหมายโดย: ${payload.assigned_by}\n`
      }
      if (payload.note) {
        message += `หมายเหตุ: ${payload.note}\n`
      }
      message += `\n📋 กรุณาเข้าระบบเพื่อดำเนินการงาน`
      break
  }

  message += `\n🔗 ID: ${payload.document_id}`

  return message
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Bot token for regular notifications
    const botToken = '7677125075:AAGH-NAyoaHdtkmizGuVM3EQeGrwBfnz2fQ'
    // Bot token for completed documents (only clerks use this bot)
    const completedBotToken = '8085934203:AAEYJaJvHC-ohuvFaIoeHz8xZJZ7jVPVsUo'

    if (!botToken || !completedBotToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set')
    }

    const payload: NotificationPayload = await req.json()

    // Validate payload
    if (!payload.type || !payload.document_id || !payload.subject || !payload.author_name) {
      throw new Error('Missing required fields in payload')
    }

    // chat_id is required in payload (from database)
    if (!payload.chat_id) {
      throw new Error('chat_id is required in payload')
    }

    const chatId = payload.chat_id

    // Determine which bot to use based on notification type
    // For clerk notifications (document_created, document_completed_clerk), use FastDoc_clerk_bot
    // For user notifications (document_approved, document_rejected, document_pending, task_assigned), use the regular bot
    const isClerkNotification = payload.type === 'document_completed_clerk' || payload.type === 'document_created'
    const selectedBotToken = isClerkNotification ? completedBotToken : botToken

    // Format and send message
    const message = formatMessage(payload)
    const result = await sendTelegramMessage(selectedBotToken, chatId, message)

    console.log('✅ Telegram notification sent:', {
      type: payload.type,
      document_id: payload.document_id,
      chat_id: chatId,
      bot_used: isClerkNotification ? 'clerk_bot' : 'regular_bot',
      result
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification sent successfully',
        telegram_response: result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Error sending Telegram notification:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
