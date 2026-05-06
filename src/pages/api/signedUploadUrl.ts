import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileId, fileName } = req.body;

    if (!fileId || !fileName) {
      return res.status(400).json({ error: "Missing fileId or fileName" });
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "shered-files";
    const storagePath = `${fileId}/${fileName}`;

    // Generate signed URL (expires in 3600 seconds = 1 hour)
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath, 3600);

    if (error) {
      console.error("Error creating signed URL:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
    });
  } catch (error: any) {
    console.error("API error:", error);
    return res.status(500).json({ error: error.message });
  }
}
