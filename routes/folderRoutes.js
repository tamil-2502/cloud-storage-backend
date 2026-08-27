const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// CREATE FOLDER
router.post("/", async (req, res) => {
    try {
        const { name, ownerId, parentId } = req.body;

        if (!name || !ownerId) {
            return res.status(400).json({
                success: false,
                message: "name and ownerId are required"
            });
        }

        const { data, error } = await supabase
            .from("folders")
            .insert([
                {
                    name: name.trim(),
                    owner_id: ownerId,
                    parent_id: parentId || null,
                    is_deleted: false
                }
            ])
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to create folder",
                error: error.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Folder created successfully",
            folder: data
        });

    } catch (error) {
        console.error("Create folder error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});
// GET FOLDER CONTENTS
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Get folder
        const { data: folder, error: folderError } = await supabase
            .from("folders")
            .select("*")
            .eq("id", id)
            .eq("is_deleted", false)
            .single();

        if (folderError || !folder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found"
            });
        }

        // Get subfolders
        const { data: folders, error: foldersError } = await supabase
            .from("folders")
            .select("*")
            .eq("parent_id", id)
            .eq("is_deleted", false)
            .order("name", { ascending: true });

        if (foldersError) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch subfolders",
                error: foldersError.message
            });
        }

        // Get files
        const { data: files, error: filesError } = await supabase
            .from("files")
            .select("*")
            .eq("folder_id", id)
            .eq("is_deleted", false)
            .order("name", { ascending: true });

        if (filesError) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch files",
                error: filesError.message
            });
        }

        res.json({
            success: true,
            folder,
            children: {
                folders,
                files
            }
        });

    } catch (error) {
        console.error("Get folder error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});
module.exports = router;