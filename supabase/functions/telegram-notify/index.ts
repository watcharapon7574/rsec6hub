// @ts-nocheck - This is a Deno Edge Function, not Node.js
// Telegram Notification Edge Function
// This function sends notifications to Telegram when documents are created, approved, or rejected

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  type: 'document_pending' | 'document_approved' | 'document_rejected' | 'document_ready' | 'document_created' | 'document_completed_clerk' | 'task_assigned' | 'task_completed' | 'task_assigned_group' | 'report_memo_completed_leader'
  document_id: string
  document_type: 'memo' | 'doc_receive'
  subject: string
  author_name: string
  requester_name?: string
  current_signer_name?: string
  current_signer_position?: string
  reject_reason?: string
  rejector_name?: string // Name of person who rejected the document
  rejector_position?: string // Position of person who rejected the document
  doc_number?: string
  urgency?: string
  assigned_by?: string // For task_assigned: name of person who assigned
  note?: string // For task_assigned: assignment note
  completed_by?: string // For task_completed: name of person who completed the task (deprecated)
  reporter_name?: string // For task_completed: name of person who reported the task
  completion_note?: string // For task_completed: the completion note/report
  chat_id?: string // Optional: specific chat to send to
  // For task_assigned_group: additional fields
  task_description?: string // รายละเอียดงาน
  event_date?: string // วันที่
  event_time?: string // เวลา
  location?: string // สถานที่
  assignee_names?: string[] // รายชื่อผู้รับมอบหมาย
  callback_data?: string // Data for inline button callback
  is_position_based?: boolean // Flag for position-based assignment (ส้ม)
}

async function sendTelegramMessage(botToken: string, chatId: string, message: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`

  const body: any = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }

  if (replyMarkup) {
    body.reply_markup = replyMarkup
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
    task_completed: '✅',
    task_assigned_group: '📢',
    report_memo_completed_leader: '📋',
  }

  const icon = emoji[payload.type] || '📄'

  let message = `${icon} <b>แจ้งเตือนเอกสาร</b>\n\n`

  switch (payload.type) {
    case 'document_pending':
      message += `<b>คุณมีเอกสารรอลงนาม</b>\n`
      message += `เรื่อง: ${payload.subject}\n`
      message += `ผู้สร้าง: ${payload.author_name}\n`
      if (payload.additional_signers && payload.additional_signers > 0) {
        message += `ผู้ลงนามเพิ่มเติม: ${payload.additional_signers} คน\n`
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
      if (payload.rejector_name) {
        message += `ปฏิเสธโดย: ${payload.rejector_name}`
        if (payload.rejector_position) {
          message += ` (${payload.rejector_position})`
        }
        message += `\n`
      }
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

    case 'task_completed':
      message += `<b>มีรายงานผลงานใหม่</b>\n`
      message += `เรื่อง: ${payload.subject}\n`
      if (payload.doc_number) {
        message += `เลขที่หนังสือ: ${payload.doc_number}\n`
      }
      if (payload.reporter_name) {
        message += `รายงานโดย: ${payload.reporter_name}\n`
      } else if (payload.completed_by) {
        // Fallback for backward compatibility
        message += `ดำเนินการโดย: ${payload.completed_by}\n`
      }
      if (payload.completion_note) {
        // Truncate long notes
        const note = payload.completion_note.length > 200
          ? payload.completion_note.substring(0, 200) + '...'
          : payload.completion_note
        message += `\n📋 รายละเอียด:\n${note}\n`
      }
      message += `\n✅ กรุณาเข้าระบบเพื่อตรวจสอบรายงานผลงาน`
      break

    case 'report_memo_completed_leader':
      message += `<b>บันทึกข้อความรายงานผลเสร็จสมบูรณ์</b>\n`
      message += `เรื่อง: ${payload.subject}\n`
      if (payload.doc_number) {
        message += `เลขที่หนังสือ: ${payload.doc_number}\n`
      }
      if (payload.reporter_name) {
        message += `รายงานโดย: ${payload.reporter_name}\n`
      }
      if (payload.completion_note) {
        const note = payload.completion_note.length > 200
          ? payload.completion_note.substring(0, 200) + '...'
          : payload.completion_note
        message += `\n📋 รายละเอียด:\n${note}\n`
      }
      message += `\n✅ บันทึกข้อความรายงานผลลงนามครบแล้ว`
      break

    case 'task_assigned_group':
      // Group announcement format
      message = `📄 <b>เรื่อง:</b> ${payload.subject}\n`
      if (payload.task_description) {
        message += `📝 <b>รายละเอียด:</b> ${payload.task_description}\n`
      }
      if (payload.event_date) {
        let dateLine = `📅 <b>วันที่:</b> ${payload.event_date}`
        if (payload.event_time) {
          dateLine += ` เวลา ${payload.event_time} น.`
        }
        message += dateLine + `\n`
      } else if (payload.event_time) {
        message += `⏰ <b>เวลา:</b> ${payload.event_time} น.\n`
      }
      if (payload.location) {
        message += `📍 <b>สถานที่:</b> ${payload.location}\n`
      }
      if (payload.doc_number) {
        message += `🔢 <b>เลขหนังสือ:</b> ${payload.doc_number}\n`
      }
      if (payload.note) {
        message += `💬 <b>หมายเหตุ:</b> ${payload.note}\n`
      }
      // แจ้งโดย: ชื่อต้น
      const assignerFirstName = (payload.assigned_by || 'ไม่ระบุ').split(' ')[0]
      message += `\n<b>แจ้งโดย:</b> ${assignerFirstName}\n`

      // Show assignee info
      if (payload.is_position_based) {
        // Position-based: show "ชื่อ และทีมงาน"
        if (payload.assignee_names && payload.assignee_names.length > 0) {
          message += `👥 <b>ผู้รับผิดชอบ:</b> ${payload.assignee_names[0]} และทีมงาน\n`
        }
      } else {
        // Name/Group-based: show all assignees
        message += `👥 <b>ผู้รับมอบหมาย:</b> ${payload.assignee_names?.length || 0} คน\n`

        // Show assignee names
        if (payload.assignee_names && payload.assignee_names.length > 0) {
          const names = payload.assignee_names
          if (names.length <= 5) {
            message += `<b>รายชื่อ:</b>\n`
            names.forEach((name, i) => {
              message += `  ${i + 1}. ${name}\n`
            })
          } else {
            message += `<b>รายชื่อ:</b>\n`
            names.slice(0, 3).forEach((name, i) => {
              message += `  ${i + 1}. ${name}\n`
            })
            message += `  ... และอีก ${names.length - 3} คน\n`
          }
        }
      }

      // ไม่แสดงลิงก์ดูเอกสารในกลุ่ม เพราะคนอื่นในกลุ่มจะเข้าถึงเอกสารได้
      message += `\n💡 ผู้รับมอบหมายสามารถดูเอกสารได้ในระบบ`

      return message
  }

  // Build clickable link to the document detail page
  const baseUrl = 'https://fastdoc.rsec6.ac.th'
  const id = payload.document_id
  const docType = payload.document_type === 'memo' ? 'memo' : 'doc_receive'
  const docUrl = `${baseUrl}/document-detail?id=${id}&type=${docType}`

  message += `\n🔗 <a href="${docUrl}">ดูเอกสาร</a>`

  return message
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Bot token for regular notifications
    const botToken = '7677125075:AAGH-NAyoaHdtkmizGuVM3EQeGrwBfnz2fQ'
    // Bot token for completed documents (only clerks use this bot)
    const completedBotToken = '8085934203:AAEYJaJvHC-ohuvFaIoeHz8xZJZ7jVPVsUo'
    // Bot token for task completion reports (notify executives when tasks are done)
    const reportBotToken = '8255772208:AAFR4SKC_Yq1ObnaIzd5zT-xzguKMksV-vE'
    // Bot token for group announcements (@i_am_noti_bot)
    const groupBotToken = '8486119730:AAHL8Dg8Zh96GNuVfthTqkZdRqRqYBYF8_A'
    // Group chat ID for task assignment announcements
    const groupChatId = '-5186986253'

    if (!botToken || !completedBotToken || !reportBotToken || !groupBotToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set')
    }

    const payload: NotificationPayload = await req.json()

    // Validate payload - author_name is not required for task_completed and task_assigned_group
    if (!payload.type || !payload.document_id || !payload.subject) {
      throw new Error('Missing required fields in payload')
    }
    // For non-task_completed, non-task_assigned_group, and non-report_memo_completed_leader types, author_name is required
    if (payload.type !== 'task_completed' && payload.type !== 'task_assigned_group' && payload.type !== 'report_memo_completed_leader' && !payload.author_name) {
      throw new Error('Missing required field: author_name')
    }

    // chat_id is required in payload (from database) EXCEPT for task_assigned_group (uses fixed group chat)
    if (!payload.chat_id && payload.type !== 'task_assigned_group') {
      throw new Error('chat_id is required in payload')
    }

    const chatId = payload.chat_id || ''

    // Determine which bot to use based on notification type
    // 1. FastDoc_clerk_bot: document_created, document_completed_clerk
    // 2. FastDoc_report_bot: task_completed (notify executives when tasks are done)
    // 3. Group bot: task_assigned_group (group announcements)
    // 4. Regular bot: document_approved, document_rejected, document_pending, task_assigned
    let selectedBotToken: string
    let botUsed: string
    let targetChatId = chatId

    if (payload.type === 'document_completed_clerk' || payload.type === 'document_created') {
      selectedBotToken = completedBotToken
      botUsed = 'clerk_bot'
    } else if (payload.type === 'task_completed') {
      selectedBotToken = reportBotToken
      botUsed = 'report_bot'
    } else if (payload.type === 'task_assigned_group') {
      selectedBotToken = groupBotToken
      botUsed = 'group_bot'
      targetChatId = groupChatId // Always send to the group
    } else {
      selectedBotToken = botToken
      botUsed = 'regular_bot'
    }

    // Format message
    const message = formatMessage(payload)

    // Prepare inline keyboard for group notifications
    let replyMarkup = undefined
    if (payload.type === 'task_assigned_group') {
      // Always show button for group notifications to open Mini App
      // Use Direct Link Mini App format: t.me/botusername?startapp=param
      // This opens the Mini App natively in Telegram (works in group chats)
      const miniAppUrl = `https://t.me/i_am_noti_bot?startapp=${payload.document_id}`

      replyMarkup = {
        inline_keyboard: [[
          {
            text: `👥 ดูรายชื่อทั้งหมด`,
            url: miniAppUrl
          }
        ]]
      }
    }

    // Send message
    const result = await sendTelegramMessage(selectedBotToken, targetChatId, message, replyMarkup)

    console.log('✅ Telegram notification sent:', {
      type: payload.type,
      document_id: payload.document_id,
      chat_id: chatId,
      bot_used: botUsed,
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
