const express = require("express");
const crypto = require("crypto");

const router = express.Router();
const supabase = require("../config/supabase");

// CREATE PUBLIC LINK
// POST /api/public-links

router.post("/", async (req, res) => {
    try {
        const { fileId, ownerId, expiresAt } = req.body;

        if (!fileId || !ownerId) {
            return res.status(400).json({
                success: false,
                message: "fileId and ownerId are required"
            });
        }

        // Check file belongs to owner
        const { data: file, error: fileError } = await supabase
            .from("files")
            .select("*")
            .eq("id", fileId)
            .eq("owner_id", ownerId)
            .eq("is_deleted", false)
            .single();

        if (fileError || !file) {
            return res.status(404).json({
                success: false,
                message: "File not found"
            });
        }

        // Generate secure token
        const token = crypto.randomBytes(32).toString("hex");

        // Create public link
        const { data: publicLink, error } = await supabase
            .from("public_links")
            .insert({
                file_id: fileId,
                token,
                created_by: ownerId,
                is_active: true,
                expires_at: expiresAt || null
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to create public link",
                error: error.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Public link created successfully",
            publicLink
        });

    } catch (error) {
        console.error("Create public link error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// ACCESS PUBLIC FILE
// GET /api/public-links/access/:token

router.get("/access/:token", async (req, res) => {
    try {
        const { token } = req.params;

        const { data: publicLink, error } = await supabase
            .from("public_links")
            .select("*")
            .eq("token", token)
            .eq("is_active", true)
            .single();

        if (error || !publicLink) {
            return res.status(404).json({
                success: false,
                message: "Public link not found or inactive"
            });
        }

        // Check expiry
        if (
            publicLink.expires_at &&
            new Date(publicLink.expires_at) < new Date()
        ) {
            return res.status(410).json({
                success: false,
                message: "Public link has expired"
            });
        }

        // Get file
        const { data: file, error: fileError } = await supabase
            .from("files")
            .select("*")
            .eq("id", publicLink.file_id)
            .eq("is_deleted", false)
            .single();

        if (fileError || !file) {
            return res.status(404).json({
                success: false,
                message: "File not found"
            });
        }

        // Download from storage
        const { data, error: downloadError } = await supabase.storage
            .from("media-files")
            .download(file.storage_key);

        if (downloadError) {
            return res.status(500).json({
                success: false,
                message: "Failed to download file",
                error: downloadError.message
            });
        }

        const buffer = Buffer.from(
            await data.arrayBuffer()
        );

        res.setHeader(
            "Content-Type",
            file.mime_type || "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${file.name}"`
        );

        res.setHeader(
            "Content-Length",
            buffer.length
        );

        res.send(buffer);

    } catch (error) {
        console.error("Public access error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// REVOKE PUBLIC LINK
// PATCH /api/public-links/:id/revoke

router.patch("/:id/revoke", async (req, res) => {
    try {
        const { id } = req.params;
        const { ownerId } = req.body;

        if (!ownerId) {
            return res.status(400).json({
                success: false,
                message: "ownerId is required"
            });
        }

        // Check link belongs to owner
        const { data: publicLink, error: fetchError } = await supabase
            .from("public_links")
            .select("*")
            .eq("id", id)
            .eq("created_by", ownerId)
            .single();

        if (fetchError || !publicLink) {
            return res.status(404).json({
                success: false,
                message: "Public link not found"
            });
        }

        // Revoke
        const { data: revokedLink, error } = await supabase
            .from("public_links")
            .update({
                is_active: false
            })
            .eq("id", id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to revoke public link",
                error: error.message
            });
        }

        res.json({
            success: true,
            message: "Public link revoked successfully",
            publicLink: revokedLink
        });

    } catch (error) {
        console.error("Revoke public link error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});


module.exports = router;