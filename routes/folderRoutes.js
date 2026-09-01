const express = require("express");

const router = express.Router();

const supabase = require("../config/supabase");
const authMiddleware = require("../middleware/authMiddleware");
router.use(authMiddleware);

// 1. CREATE FOLDER
// POST /api/folders

router.post("/", async (req, res) => {
    try {
        const { name, ownerId, parentId } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Folder name is required"
            });
        }

        if (!ownerId) {
            return res.status(400).json({
                success: false,
                message: "ownerId is required"
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

// 2. SEARCH FOLDERS
// GET /api/folders/search?ownerId=USER_ID&q=NAME

router.get("/search", async (req, res) => {
    try {
        const { ownerId, q } = req.query;

        if (!ownerId) {
            return res.status(400).json({
                success: false,
                message: "ownerId is required"
            });
        }

        if (!q || !q.trim()) {
            return res.status(400).json({
                success: false,
                message: "Search query is required"
            });
        }

        const searchText = q.trim();

        const { data: folders, error } = await supabase
            .from("folders")
            .select("*")
            .eq("owner_id", ownerId)
            .eq("is_deleted", false)
            .ilike("name", `%${searchText}%`)
            .order("created_at", { ascending: false });

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to search folders",
                error: error.message
            });
        }

        res.json({
            success: true,
            query: searchText,
            total: folders.length,
            folders
        });

    } catch (error) {
        console.error("Search folders error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// 3. GET ALL ROOT FOLDERS
// GET /api/folders?ownerId=USER_ID

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
            .from("folders")
            .select("*")
            .eq("owner_id", ownerId)
            .eq("is_deleted", false)
            .is("parent_id", null)
            .order("name", { ascending: true });

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch folders",
                error: error.message
            });
        }

        res.json({
            success: true,
            folders: data
        });

    } catch (error) {
        console.error("Get folders error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// 4. GET DELETED FOLDERS
// GET /api/folders/trash/list?ownerId=USER_ID

router.get("/trash/list", async (req, res) => {
    try {
        const { ownerId } = req.query;

        if (!ownerId) {
            return res.status(400).json({
                success: false,
                message: "ownerId is required"
            });
        }

        const { data, error } = await supabase
            .from("folders")
            .select("*")
            .eq("owner_id", ownerId)
            .eq("is_deleted", true)
            .order("updated_at", { ascending: false });

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch deleted folders",
                error: error.message
            });
        }

        res.json({
            success: true,
            trash: data
        });

    } catch (error) {
        console.error("Get deleted folders error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// 5. GET FOLDER DETAILS
// GET /api/folders/details/:id

router.get("/details/:id", async (req, res) => {
    try {
        const { id } = req.params;

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

        res.json({
            success: true,
            type: "folder",
            folder,
            children: {
                files,
                folders
            }
        });

    } catch (error) {
        console.error("Get folder details error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// 6. GET FOLDER CONTENTS
// GET /api/folders/:id

router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

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

// 7. CREATE SUBFOLDER
// POST /api/folders/:id/subfolder

router.post("/:id/subfolder", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, ownerId } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Folder name is required"
            });
        }

        if (!ownerId) {
            return res.status(400).json({
                success: false,
                message: "ownerId is required"
            });
        }

        const { data: parentFolder, error: parentError } = await supabase
            .from("folders")
            .select("*")
            .eq("id", id)
            .eq("owner_id", ownerId)
            .eq("is_deleted", false)
            .single();

        if (parentError || !parentFolder) {
            return res.status(404).json({
                success: false,
                message: "Parent folder not found"
            });
        }

        const { data: folder, error } = await supabase
            .from("folders")
            .insert([
                {
                    name: name.trim(),
                    owner_id: ownerId,
                    parent_id: id,
                    is_deleted: false
                }
            ])
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to create subfolder",
                error: error.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Subfolder created successfully",
            folder
        });

    } catch (error) {
        console.error("Create subfolder error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// 8. RENAME FOLDER
// PATCH /api/folders/:id

router.patch("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Folder name is required"
            });
        }

        const { data: folder, error: fetchError } = await supabase
            .from("folders")
            .select("*")
            .eq("id", id)
            .eq("is_deleted", false)
            .single();

        if (fetchError || !folder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found"
            });
        }

        const { data: updatedFolder, error: updateError } = await supabase
            .from("folders")
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
                message: "Failed to rename folder",
                error: updateError.message
            });
        }

        res.json({
            success: true,
            message: "Folder renamed successfully",
            folder: updatedFolder
        });

    } catch (error) {
        console.error("Rename folder error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// 9. MOVE FOLDER
// PATCH /api/folders/:id/move

router.patch("/:id/move", async (req, res) => {
    try {
        const { id } = req.params;
        const { parentId, ownerId } = req.body;

        if (!ownerId) {
            return res.status(400).json({
                success: false,
                message: "ownerId is required"
            });
        }

        const { data: folder, error: folderError } = await supabase
            .from("folders")
            .select("*")
            .eq("id", id)
            .eq("owner_id", ownerId)
            .eq("is_deleted", false)
            .single();

        if (folderError || !folder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found"
            });
        }

        if (parentId === id) {
            return res.status(400).json({
                success: false,
                message: "A folder cannot be moved into itself"
            });
        }

        if (parentId) {
            const { data: parentFolder, error: parentError } =
                await supabase
                    .from("folders")
                    .select("*")
                    .eq("id", parentId)
                    .eq("owner_id", ownerId)
                    .eq("is_deleted", false)
                    .single();

            if (parentError || !parentFolder) {
                return res.status(404).json({
                    success: false,
                    message: "Destination folder not found"
                });
            }
        }

        const { data: movedFolder, error: updateError } =
            await supabase
                .from("folders")
                .update({
                    parent_id: parentId || null,
                    updated_at: new Date().toISOString()
                })
                .eq("id", id)
                .select()
                .single();

        if (updateError) {
            return res.status(500).json({
                success: false,
                message: "Failed to move folder",
                error: updateError.message
            });
        }

        res.json({
            success: true,
            message: "Folder moved successfully",
            folder: movedFolder
        });

    } catch (error) {
        console.error("Move folder error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// 10. DELETE FOLDER - MOVE TO TRASH
// DELETE /api/folders/:id

router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const { data: folder, error: fetchError } = await supabase
            .from("folders")
            .select("*")
            .eq("id", id)
            .eq("is_deleted", false)
            .single();

        if (fetchError || !folder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found"
            });
        }

        const { data: deletedFolder, error: deleteError } =
            await supabase
                .from("folders")
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
                message: "Failed to delete folder",
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: "Folder moved to trash successfully",
            folder: deletedFolder
        });

    } catch (error) {
        console.error("Delete folder error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// 11. RESTORE FOLDER
// POST /api/folders/:id/restore

router.post("/:id/restore", async (req, res) => {
    try {
        const { id } = req.params;

        const { data: folder, error: fetchError } = await supabase
            .from("folders")
            .select("*")
            .eq("id", id)
            .eq("is_deleted", true)
            .single();

        if (fetchError || !folder) {
            return res.status(404).json({
                success: false,
                message: "Deleted folder not found"
            });
        }

        const { data: restoredFolder, error: restoreError } =
            await supabase
                .from("folders")
                .update({
                    is_deleted: false,
                    updated_at: new Date().toISOString()
                })
                .eq("id", id)
                .select()
                .single();

        if (restoreError) {
            return res.status(500).json({
                success: false,
                message: "Failed to restore folder",
                error: restoreError.message
            });
        }

        res.json({
            success: true,
            message: "Folder restored successfully",
            folder: restoredFolder
        });

    } catch (error) {
        console.error("Restore folder error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// 12. PERMANENTLY DELETE FOLDER
// DELETE /api/folders/:id/permanent

router.delete("/:id/permanent", async (req, res) => {
    try {
        const { id } = req.params;
        const { ownerId } = req.body;

        if (!ownerId) {
            return res.status(400).json({
                success: false,
                message: "ownerId is required"
            });
        }

        const { data: folder, error: fetchError } = await supabase
            .from("folders")
            .select("*")
            .eq("id", id)
            .eq("owner_id", ownerId)
            .eq("is_deleted", true)
            .single();

        if (fetchError || !folder) {
            return res.status(404).json({
                success: false,
                message: "Deleted folder not found"
            });
        }

        const { error: deleteError } = await supabase
            .from("folders")
            .delete()
            .eq("id", id);

        if (deleteError) {
            return res.status(500).json({
                success: false,
                message: "Failed to permanently delete folder",
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: "Folder permanently deleted"
        });

    } catch (error) {
        console.error("Permanent delete error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});


module.exports = router;