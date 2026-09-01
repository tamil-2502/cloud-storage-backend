const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const multer = require("multer");
const upload = multer({
    storage: multer.memoryStorage()
});
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
// GET TRASH FILES
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
            .from("files")
            .select("*")
            .eq("owner_id", ownerId)
            .eq("is_deleted", true)
            .order("updated_at", { ascending: false });

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch trash",
                error: error.message
            });
        }

        res.json({
            success: true,
            trash: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});
// RESTORE FILE FROM TRASH
router.post("/:id/restore", async (req, res) => {
    try {
        const { id } = req.params;

        // Check deleted file exists
        const { data: file, error: fetchError } = await supabase
            .from("files")
            .select("*")
            .eq("id", id)
            .eq("is_deleted", true)
            .single();

        if (fetchError || !file) {
            return res.status(404).json({
                success: false,
                message: "Deleted file not found"
            });
        }

        // Restore file
        const { data: restoredFile, error: restoreError } = await supabase
            .from("files")
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
                message: "Failed to restore file",
                error: restoreError.message
            });
        }

        res.json({
            success: true,
            message: "File restored successfully",
            file: restoredFile
        });

    } catch (error) {
        console.error("Restore file error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// SEARCH FILES
// GET /api/files/search?ownerId=USER_ID&q=FILE_NAME

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

        const { data: files, error } = await supabase
            .from("files")
            .select("*")
            .eq("owner_id", ownerId)
            .eq("is_deleted", false)
            .ilike("name", `%${searchText}%`)
            .order("created_at", { ascending: false });

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to search files",
                error: error.message
            });
        }

        res.json({
            success: true,
            query: searchText,
            total: files.length,
            files
        });

    } catch (error) {
        console.error("Search files error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});
// DOWNLOAD FILE
router.get("/:id/download", async (req, res) => {
    try {
        const { id } = req.params;

        // Find file in database
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

        // Download file from Supabase Storage
        const { data, error } = await supabase.storage
            .from("media-files")
            .download(file.storage_key);

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to download file",
                error: error.message
            });
        }

        // Convert Blob to Buffer
        const buffer = Buffer.from(await data.arrayBuffer());

        // Set response headers
        res.setHeader(
            "Content-Type",
            file.mime_type || "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${file.name}"`
        );

        res.setHeader("Content-Length", buffer.length);

        res.send(buffer);

    } catch (error) {
        console.error("Download error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// DOWNLOAD SHARED FILE

router.get("/:id/shared-download/:userId", async (req, res) => {
    try {
        const { id, userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "userId is required"
            });
        }

        // Check whether file exists
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

        // Check whether this user has access
        const { data: share, error: shareError } = await supabase
            .from("shares")
            .select("*")
            .eq("resource_type", "file")
            .eq("resource_id", id)
            .eq("grantee_user_id", userId)
            .in("role", ["viewer", "editor"])
            .maybeSingle();

        if (shareError) {
            return res.status(500).json({
                success: false,
                message: "Failed to check share access",
                error: shareError.message
            });
        }

        if (!share) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this file"
            });
        }

        // Download from Supabase Storage
        const { data, error } = await supabase.storage
            .from("media-files")
            .download(file.storage_key);

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to download shared file",
                error: error.message
            });
        }

        // Convert Blob to Buffer
        const buffer = Buffer.from(
            await data.arrayBuffer()
        );

        // Response headers
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
        console.error("Shared download error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// UPLOAD NEW VERSION OF FILE

router.post("/:id/versions", upload.single("file"), async (req, res) => {
    try {
        const { id } = req.params;
        const { createdBy } = req.body;

        // Validate file
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "File is required"
            });
        }

        // Validate createdBy
        if (!createdBy) {
            return res.status(400).json({
                success: false,
                message: "createdBy is required"
            });
        }

        // Check existing file
        const { data: existingFile, error: fileError } = await supabase
            .from("files")
            .select("*")
            .eq("id", id)
            .eq("is_deleted", false)
            .single();

        if (fileError || !existingFile) {
            return res.status(404).json({
                success: false,
                message: "File not found"
            });
        }

        // Get latest version number
        const { data: latestVersion, error: latestError } = await supabase
            .from("file_versions")
            .select("version_number")
            .eq("file_id", id)
            .order("version_number", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestError) {
            return res.status(500).json({
                success: false,
                message: "Failed to get latest version",
                error: latestError.message
            });
        }

        const versionNumber = latestVersion
            ? latestVersion.version_number + 1
            : 1;

        // Create unique storage key
        const storageKey =
            `users/${existingFile.owner_id}/versions/${existingFile.id}/version-${versionNumber}-${Date.now()}`;

        // Upload new version to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from("media-files")
            .upload(storageKey, req.file.buffer, {
                contentType:
                    req.file.mimetype ||
                    "application/octet-stream",
                upsert: false
            });

        if (uploadError) {
            return res.status(500).json({
                success: false,
                message: "Failed to upload new version",
                error: uploadError.message
            });
        }

        // Save version information
        const { data: version, error: versionError } = await supabase
            .from("file_versions")
            .insert({
                file_id: existingFile.id,
                version_number: versionNumber,
                storage_key: storageKey,
                size_bytes: req.file.size,
                mime_type: req.file.mimetype,
                checksum: null,
                created_by: createdBy
            })
            .select()
            .single();

        if (versionError) {

            // Remove uploaded file if database insert fails
            await supabase.storage
                .from("media-files")
                .remove([storageKey]);

            return res.status(500).json({
                success: false,
                message: "Failed to save file version",
                error: versionError.message
            });
        }

        // Update current file
        const { data: updatedFile, error: updateError } =
            await supabase
                .from("files")
                .update({
                    storage_key: storageKey,
                    size_bytes: req.file.size,
                    mime_type: req.file.mimetype,
                    version_id: version.id,
                    updated_at: new Date().toISOString()
                })
                .eq("id", id)
                .select()
                .single();

        if (updateError) {

            // Remove uploaded version if file update fails
            await supabase
                .from("file_versions")
                .delete()
                .eq("id", version.id);

            await supabase.storage
                .from("media-files")
                .remove([storageKey]);

            return res.status(500).json({
                success: false,
                message: "Failed to update current file",
                error: updateError.message
            });
        }

        res.status(201).json({
            success: true,
            message: "New file version uploaded successfully",
            version,
            file: updatedFile
        });

    } catch (error) {
        console.error("Upload new version error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});
// GET FILE VERSION HISTORY

router.get("/:id/versions", async (req, res) => {
    try {
        const { id } = req.params;

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

        // Get all versions
        const { data: versions, error: versionError } = await supabase
            .from("file_versions")
            .select("*")
            .eq("file_id", id)
            .order("version_number", { ascending: false });

        if (versionError) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch file versions",
                error: versionError.message
            });
        }

        res.json({
            success: true,
            file: {
                id: file.id,
                name: file.name,
                mime_type: file.mime_type,
                size_bytes: file.size_bytes
            },
            totalVersions: versions.length,
            versions: versions
        });

    } catch (error) {
        console.error("Version history error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// RESTORE OLD FILE VERSION

router.post("/:id/versions/:versionId/restore", async (req, res) => {
    try {
        const { id, versionId } = req.params;

        // Check current file
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

        // Find requested version
        const { data: version, error: versionError } = await supabase
            .from("file_versions")
            .select("*")
            .eq("id", versionId)
            .eq("file_id", id)
            .single();

        if (versionError || !version) {
            return res.status(404).json({
                success: false,
                message: "File version not found"
            });
        }

        // Check whether version exists in Supabase Storage
        const { data: versionFile, error: downloadError } =
            await supabase.storage
                .from("media-files")
                .download(version.storage_key);

        if (downloadError || !versionFile) {
            return res.status(404).json({
                success: false,
                message: "Version file not found in storage"
            });
        }

        // Create a new version number
        const { data: latestVersion, error: latestError } =
            await supabase
                .from("file_versions")
                .select("version_number")
                .eq("file_id", id)
                .order("version_number", { ascending: false })
                .limit(1)
                .maybeSingle();

        if (latestError) {
            return res.status(500).json({
                success: false,
                message: "Failed to get latest version",
                error: latestError.message
            });
        }

        const newVersionNumber =
            latestVersion
                ? latestVersion.version_number + 1
                : 1;

        // Create storage key for restored version
        const newStorageKey =
            `users/${file.owner_id}/versions/${file.id}/version-${newVersionNumber}-${Date.now()}`;

        // Convert Blob to Buffer
        const buffer = Buffer.from(
            await versionFile.arrayBuffer()
        );

        // Upload restored version to storage
        const { error: uploadError } = await supabase.storage
            .from("media-files")
            .upload(newStorageKey, buffer, {
                contentType:
                    version.mime_type ||
                    file.mime_type ||
                    "application/octet-stream",
                upsert: false
            });

        if (uploadError) {
            return res.status(500).json({
                success: false,
                message: "Failed to restore version to storage",
                error: uploadError.message
            });
        }

        // Save current file as a version before replacing it
        const { error: saveCurrentError } = await supabase
            .from("file_versions")
            .insert({
                file_id: file.id,
                version_number: newVersionNumber,
                storage_key: newStorageKey,
                size_bytes: file.size_bytes,
                mime_type: file.mime_type,
                checksum: file.checksum,
                created_by: file.owner_id
            });

        if (saveCurrentError) {
            // Cleanup uploaded storage file
            await supabase.storage
                .from("media-files")
                .remove([newStorageKey]);

            return res.status(500).json({
                success: false,
                message: "Failed to create restored version record",
                error: saveCurrentError.message
            });
        }

        // Replace current file metadata
        const { data: updatedFile, error: updateError } =
            await supabase
                .from("files")
                .update({
                    storage_key: version.storage_key,
                    size_bytes: version.size_bytes,
                    mime_type: version.mime_type,
                    checksum: version.checksum,
                    version_id: version.id,
                    updated_at: new Date().toISOString()
                })
                .eq("id", id)
                .select()
                .single();

        if (updateError) {
            return res.status(500).json({
                success: false,
                message: "Failed to restore file version",
                error: updateError.message
            });
        }

        res.json({
            success: true,
            message: "File version restored successfully",
            restoredVersion: version,
            file: updatedFile
        });

    } catch (error) {
        console.error("Restore version error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// GET FILE DETAILS
router.get("/details/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const { data: file, error } = await supabase
            .from("files")
            .select("*")
            .eq("id", id)
            .eq("is_deleted", false)
            .single();

        if (error || !file) {
            return res.status(404).json({
                success: false,
                message: "File not found"
            });
        }

        res.json({
            success: true,
            type: "file",
            file
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

module.exports = router;