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
    const { storagePath } = req.body;

    if (!storagePath) {
      return res.status(400).json({ error: "Missing storagePath" });
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "shered-files";

    const { error } = await supabase.storage
      .from(bucket)
      .remove([storagePath]);

    if (error) {
      console.error("Error deleting file:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("API error:", error);
    return res.status(500).json({ error: error.message });
  }
}
