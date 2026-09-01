const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");
const authMiddleware = require("../middleware/authMiddleware");

// Generate Signed URL for a file
router.get("/:fileId", authMiddleware, async (req, res) => {
    try {
        const { fileId } = req.params;

        // Get file
        const {
    data: file,
    error: fileError
} = await supabase
    .from("files")
    .select("*")
    .eq("id", fileId)
    .maybeSingle();

if (fileError) {
    console.error("File DB error:", fileError);

    return res.status(500).json({
        success: false,
        message: "Failed to find file",
        error: fileError.message
    });
}

if (!file) {
    return res.status(404).json({
        success: false,
        message: "File not found",
        fileId
    });
}

if (file.is_deleted === true) {
    return res.status(404).json({
        success: false,
        message: "File is deleted"
    });
}

        // Check ownership
        if (file.owner_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to access this file"
            });
        }

        // Create signed URL
        const { data, error } = await supabase.storage
            .from("media-files")
            .createSignedUrl(file.storage_key, 3600);

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to create signed URL",
                error: error.message
            });
        }

        res.json({
            success: true,
            message: "Signed URL created successfully",
            fileId: file.id,
            fileName: file.name,
            signedUrl: data.signedUrl,
            expiresIn: 3600
        });

    } catch (error) {
        console.error("Signed URL error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

module.exports = router;