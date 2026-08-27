const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// GET all files of a user
router.get("/", async (req, res) => {
    try {
        const { ownerId } = req.query;

        if (!ownerId) {
            return res.status(400).json({
                success: false,
                message: "ownerId is required"
            });
        }

        const { data, error } = await supabase
            .from("files")
            .select("*")
            .eq("owner_id", ownerId)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false });

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch files",
                error: error.message
            });
        }

        res.json({
            success: true,
            files: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});


// PATCH - Rename file
router.patch("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "File name is required"
            });
        }

        // Check file exists
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

        // Update file name
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
            return res.status(500).json({
                success: false,
                message: "Failed to rename file",
                error: updateError.message
            });
        }

        res.json({
            success: true,
            message: "File renamed successfully",
            file: updatedFile
        });

    } catch (error) {
        console.error("Rename error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});
// MOVE FILE TO FOLDER
router.patch("/:id/move", async (req, res) => {
    try {
        const { id } = req.params;
        const { folderId } = req.body;

        // Check file exists
        const { data: file, error: fileError } = await supabase
            .from("files")
            .select("*")
            .eq("id", id)
            .eq("is_deleted", false)
            .single();

        if (fileError || !file) {
            return res.status(404).json({
                success: false,
                message: "File not found"
            });
        }

        // If folderId is provided, check folder exists
        if (folderId) {
            const { data: folder, error: folderError } = await supabase
                .from("folders")
                .select("*")
                .eq("id", folderId)
                .eq("is_deleted", false)
                .single();

            if (folderError || !folder) {
                return res.status(404).json({
                    success: false,
                    message: "Destination folder not found"
                });
            }
        }

        // Move file
        const { data: updatedFile, error: updateError } = await supabase
            .from("files")
            .update({
                folder_id: folderId || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json({
                success: false,
                message: "Failed to move file",
                error: updateError.message
            });
        }

        res.json({
            success: true,
            message: "File moved successfully",
            file: updatedFile
        });

    } catch (error) {
        console.error("Move file error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});
// DELETE FILE - SOFT DELETE / TRASH
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Check file exists
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

        // Move file to Trash
        const { data: deletedFile, error: deleteError } = await supabase
            .from("files")
            .update({
                is_deleted: true,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select()
            .single();

        if (deleteError) {
            return res.status(500).json({
                success: false,
                message: "Failed to move file to trash",
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: "File moved to trash successfully",
            file: deletedFile
        });

    } catch (error) {
        console.error("Delete file error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

module.exports = router;