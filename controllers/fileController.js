const supabase = require("../config/supabase");
const crypto = require("crypto");

const uploadFile = async (req, res) => {
  try {
    // Check whether file was received
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const file = req.file;
    const userId = req.user.id;

    // Create unique file name
    const fileExtension = file.originalname.includes(".")
      ? "." + file.originalname.split(".").pop()
      : "";

    const uniqueName =
      `${crypto.randomUUID()}${fileExtension}`;

    // Storage path
    const storageKey = `users/${userId}/${uniqueName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("media-files")
      .upload(storageKey, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);

      return res.status(500).json({
        success: false,
        message: "File upload failed",
        error: uploadError.message
      });
    }

    // Save metadata in database
    const { data: fileData, error: dbError } = await supabase
      .from("files")
      .insert({
        name: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        storage_key: storageKey,
        owner_id: userId
      })
      .select()
      .single();

    // If database insert fails, remove uploaded object
    if (dbError) {
      await supabase.storage
        .from("media-files")
        .remove([storageKey]);

      console.error("Database error:", dbError);

      return res.status(500).json({
        success: false,
        message: "File metadata could not be saved",
        error: dbError.message
      });
    }

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      file: {
        id: fileData.id,
        name: fileData.name,
        mimeType: fileData.mime_type,
        sizeBytes: fileData.size_bytes,
        storageKey: fileData.storage_key,
        ownerId: fileData.owner_id,
        createdAt: fileData.created_at
      }
    });

  } catch (error) {
    console.error("Upload error:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
const renameFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "File name is required"
      });
    }

    const { data: file, error: fetchError } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !file) {
      return res.status(404).json({
        success: false,
        message: "File not found"
      });
    }

    const { data: updatedFile, error: updateError } = await supabase
      .from("files")
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.json({
      success: true,
      message: "File renamed successfully",
      file: updatedFile
    });

  } catch (error) {
    console.error("Rename file error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to rename file",
      error: error.message
    });
  }
};
module.exports = {
  uploadFile,
  renameFile
};