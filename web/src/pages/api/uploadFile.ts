import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm } from "formidable";
import fs from "fs";

function getSupabaseServerConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return { supabaseUrl, supabaseServiceRoleKey };
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const config = getSupabaseServerConfig();
    if (!config) {
      return res.status(503).json({
        error:
          "Supabase server configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel.",
      });
    }

    const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const form = new IncomingForm();

    const [fields, files] = await form.parse(req);

    const fileId = fields.fileId?.[0];
    const fileName = fields.fileName?.[0];
    const file = files.file?.[0];

    if (!fileId || !fileName || !file) {
      return res
        .status(400)
        .json({ error: "Missing fileId, fileName, or file" });
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "shared-files";
    const storagePath = `${fileId}/${fileName}`;

    // Read file from disk
    const fileContent = fs.readFileSync(file.filepath);

    // Upload directly via service role
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileContent, {
        contentType: file.mimetype || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      return res.status(400).json({ error: error.message });
    }

    // Generate public URL
    const downloadUrl = `${config.supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;

    return res.status(200).json({
      success: true,
      storagePath,
      downloadUrl,
    });
  } catch (error: any) {
    console.error("API error:", error);
    return res.status(500).json({ error: error.message });
  }
}
