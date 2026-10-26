import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // params is a Promise in Next.js 15+
) {
  const { id: quoteId } = await params;

  try {
    // 1. Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from('quote_messages')
      .select(`
        *,
        quote_message_attachments (*)
      `)
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;

    // 2. Generate Signed URLs for attachments
    const messagesWithSignedUrls = await Promise.all(
      (messages || []).map(async (msg) => {
        const sensitiveAttachments = await Promise.all(
          (msg.quote_message_attachments || []).map(async (att: any) => {
            const { data, error } = await supabase
              .storage
              .from('quote_attachments')
              .createSignedUrl(att.file_path, 300); // 5 minutes expiry

            return {
              ...att,
              signedUrl: data?.signedUrl || null,
            };
          })
        );
        return { ...msg, attachments: sensitiveAttachments };
      })
    );

    return NextResponse.json(messagesWithSignedUrls);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: quoteId } = await params;

  try {
    const formData = await request.formData();
    const text = formData.get('text') as string;
    const authorName = formData.get('authorName') as string || 'Client'; // Default to Client
    const authorEmail = formData.get('authorEmail') as string || '';
    const files = formData.getAll('files') as File[];

    // 1. Create Message Record
    const { data: messageData, error: msgError } = await supabase
      .from('quote_messages')
      .insert({
        quote_id: quoteId,
        text: text,
        author_name: authorName,
        author_email: authorEmail,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    const messageId = messageData.id;
    const uploadedAttachments = [];

    // 2. Upload Files
    for (const file of files) {
      if (file.size === 0) continue;

      const fileExt = file.name.split('.').pop();
      const uniqueName = `${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `quotes/${quoteId}/${messageId}/${uniqueName}`;

      // Upload to Storage
      const { error: uploadError } = await supabase
        .storage
        .from('quote_attachments')
        .upload(filePath, file);

      if (uploadError) {
        console.error(`Failed to upload ${file.name}:`, uploadError);
        continue; // Skip failed upload 
      }

      // Record Attachment in DB
      const { data: attData, error: attError } = await supabase
        .from('quote_message_attachments')
        .insert({
          message_id: messageId,
          bucket_id: 'quote_attachments',
          file_path: filePath,
          mime_type: file.type,
          file_size: file.size,
          original_name: file.name,
        })
        .select()
        .single();

      if (!attError && attData) {
        // Get immediate signed URL for the response
        const { data: signed } = await supabase.storage.from('quote_attachments').createSignedUrl(filePath, 300);
        uploadedAttachments.push({ ...attData, signedUrl: signed?.signedUrl });
      }
    }

    // Return the complete message object
    return NextResponse.json({
      ...messageData,
      attachments: uploadedAttachments
    });

  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
