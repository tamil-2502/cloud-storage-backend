const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// 1. GET FILE VERSION HISTORY

router.get("/:fileId", async (req, res) => {
    try {
        const { fileId } = req.params;

        // Get file
        const { data: file, error: fileError } = await supabase
            .from("files")
            .select("id, name, mime_type, size_bytes")
            .eq("id", fileId)
            .eq("is_deleted", false)
            .single();

        if (fileError || !file) {
            return res.status(404).json({
                success: false,
                message: "File not found"
            });
        }

        // Get versions
        const { data: versions, error: versionError } = await supabase
            .from("file_versions")
            .select("*")
            .eq("file_id", fileId)
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
            file,
            totalVersions: versions.length,
            versions
        });

    } catch (error) {
        console.error("Get versions error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// 2. DOWNLOAD SPECIFIC FILE VERSION

router.get(
    "/:fileId/version/:versionId/download",
    async (req, res) => {
        try {
            const { fileId, versionId } = req.params;

            // Find version
            const { data: version, error: versionError } =
                await supabase
                    .from("file_versions")
                    .select("*")
                    .eq("id", versionId)
                    .eq("file_id", fileId)
                    .single();

            if (versionError || !version) {
                return res.status(404).json({
                    success: false,
                    message: "File version not found"
                });
            }

            // Download from Supabase Storage
            const { data, error: downloadError } =
                await supabase.storage
                    .from("media-files")
                    .download(version.storage_key);

            if (downloadError) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to download file version",
                    error: downloadError.message
                });
            }

            // Convert Blob to Buffer
            const buffer = Buffer.from(
                await data.arrayBuffer()
            );

            // Get original file name
            const { data: file } = await supabase
                .from("files")
                .select("name")
                .eq("id", fileId)
                .single();

            const originalName = file?.name || "file";

            // Create version filename
            const extension = originalName.includes(".")
                ? "." + originalName.split(".").pop()
                : "";

            const baseName = originalName.includes(".")
                ? originalName.substring(
                    0,
                    originalName.lastIndexOf(".")
                )
                : originalName;

            const downloadName =
                `${baseName}_version_${version.version_number}${extension}`;

            // Headers
            res.setHeader(
                "Content-Type",
                version.mime_type ||
                "application/octet-stream"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${downloadName}"`
            );

            res.setHeader(
                "Content-Length",
                buffer.length
            );

            res.send(buffer);

        } catch (error) {
            console.error(
                "Download version error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Server error",
                error: error.message
            });
        }
    }
);

// 3. RESTORE OLD FILE VERSION

router.post(
    "/:fileId/version/:versionId/restore",
    async (req, res) => {
        try {
            const { fileId, versionId } = req.params;

            // Find version
            const { data: version, error: versionError } =
                await supabase
                    .from("file_versions")
                    .select("*")
                    .eq("id", versionId)
                    .eq("file_id", fileId)
                    .single();

            if (versionError || !version) {
                return res.status(404).json({
                    success: false,
                    message: "File version not found"
                });
            }

            // Find current file
            const { data: file, error: fileError } =
                await supabase
                    .from("files")
                    .select("*")
                    .eq("id", fileId)
                    .eq("is_deleted", false)
                    .single();

            if (fileError || !file) {
                return res.status(404).json({
                    success: false,
                    message: "File not found"
                });
            }

            // Restore selected version
            const {
                data: restoredFile,
                error: updateError
            } = await supabase
                .from("files")
                .update({
                    storage_key: version.storage_key,
                    size_bytes: version.size_bytes,
                    mime_type: version.mime_type,
                    version_id: version.id,
                    updated_at: new Date().toISOString()
                })
                .eq("id", fileId)
                .select()
                .single();

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to restore file version",
                    error: updateError.message
                });
            }

            res.json({
                success: true,
                message:
                    `Version ${version.version_number} restored successfully`,
                restoredVersion: version,
                file: restoredFile
            });

        } catch (error) {
            console.error(
                "Restore version error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Server error",
                error: error.message
            });
        }
    }
);

// 4. DELETE SPECIFIC FILE VERSION

router.delete(
    "/:fileId/version/:versionId",
    async (req, res) => {
        try {
            const { fileId, versionId } = req.params;

            // Find version
            const { data: version, error: versionError } =
                await supabase
                    .from("file_versions")
                    .select("*")
                    .eq("id", versionId)
                    .eq("file_id", fileId)
                    .single();

            if (versionError || !version) {
                return res.status(404).json({
                    success: false,
                    message: "File version not found"
                });
            }

            // Check current active version
            const { data: file, error: fileError } =
                await supabase
                    .from("files")
                    .select("version_id")
                    .eq("id", fileId)
                    .single();

            if (fileError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to check current version",
                    error: fileError.message
                });
            }

            // Don't delete active version
            if (
                file &&
                file.version_id === versionId
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Cannot delete the currently active version. Restore another version first."
                });
            }

            // Delete from Storage
            const { error: storageError } =
                await supabase.storage
                    .from("media-files")
                    .remove([version.storage_key]);

            if (storageError) {
                console.error(
                    "Storage delete error:",
                    storageError
                );
            }

            // Delete from database
            const { error: deleteError } =
                await supabase
                    .from("file_versions")
                    .delete()
                    .eq("id", versionId)
                    .eq("file_id", fileId);

            if (deleteError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to delete file version",
                    error: deleteError.message
                });
            }

            res.json({
                success: true,
                message:
                    `Version ${version.version_number} deleted successfully`,
                version
            });

        } catch (error) {
            console.error(
                "Delete version error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Server error",
                error: error.message
            });
        }
    }
);

// EXPORT
module.exports = router;