const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// STAR FILE OR FOLDER
router.post("/", async (req, res) => {
    try {
        const {
            userId,
            resourceType,
            resourceId
        } = req.body;

        if (!userId || !resourceType || !resourceId) {
            return res.status(400).json({
                success: false,
                message: "userId, resourceType and resourceId are required"
            });
        }

        if (!["file", "folder"].includes(resourceType)) {
            return res.status(400).json({
                success: false,
                message: "resourceType must be file or folder"
            });
        }

        const table = resourceType === "file"
            ? "files"
            : "folders";

        // Check resource exists
        const { data: resource, error: resourceError } = await supabase
            .from(table)
            .select("*")
            .eq("id", resourceId)
            .eq("is_deleted", false)
            .single();

        if (resourceError || !resource) {
            return res.status(404).json({
                success: false,
                message: `${resourceType} not found`
            });
        }

        // Check already starred
        const { data: existingStar } = await supabase
            .from("stars")
            .select("*")
            .eq("user_id", userId)
            .eq("resource_type", resourceType)
            .eq("resource_id", resourceId)
            .maybeSingle();

        if (existingStar) {
            return res.status(400).json({
                success: false,
                message: `${resourceType} is already starred`
            });
        }

        // Create star
        const { data: star, error } = await supabase
            .from("stars")
            .insert({
                user_id: userId,
                resource_type: resourceType,
                resource_id: resourceId
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to star resource",
                error: error.message
            });
        }

        res.status(201).json({
            success: true,
            message: `${resourceType} starred successfully`,
            star
        });

    } catch (error) {
        console.error("Star error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// GET STARRED FILES AND FOLDERS
router.get("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: stars, error } = await supabase
            .from("stars")
            .select("*")
            .eq("user_id", userId);

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch starred resources",
                error: error.message
            });
        }

        const fileIds = stars
            .filter(star => star.resource_type === "file")
            .map(star => star.resource_id);

        const folderIds = stars
            .filter(star => star.resource_type === "folder")
            .map(star => star.resource_id);

        let files = [];
        let folders = [];

        // Get starred files
        if (fileIds.length > 0) {
            const { data, error: fileError } = await supabase
                .from("files")
                .select("*")
                .in("id", fileIds)
                .eq("is_deleted", false);

            if (fileError) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch starred files",
                    error: fileError.message
                });
            }

            files = data || [];
        }

        // Get starred folders
        if (folderIds.length > 0) {
            const { data, error: folderError } = await supabase
                .from("folders")
                .select("*")
                .in("id", folderIds)
                .eq("is_deleted", false);

            if (folderError) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch starred folders",
                    error: folderError.message
                });
            }

            folders = data || [];
        }

        res.json({
            success: true,
            total: files.length + folders.length,
            files,
            folders
        });

    } catch (error) {
        console.error("Get stars error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// UNSTAR FILE OR FOLDER
router.delete("/", async (req, res) => {
    try {
        const {
            userId,
            resourceType,
            resourceId
        } = req.body;

        if (!userId || !resourceType || !resourceId) {
            return res.status(400).json({
                success: false,
                message: "userId, resourceType and resourceId are required"
            });
        }

        if (!["file", "folder"].includes(resourceType)) {
            return res.status(400).json({
                success: false,
                message: "resourceType must be file or folder"
            });
        }

        const { data: star, error: findError } = await supabase
            .from("stars")
            .select("*")
            .eq("user_id", userId)
            .eq("resource_type", resourceType)
            .eq("resource_id", resourceId)
            .maybeSingle();

        if (findError || !star) {
            return res.status(404).json({
                success: false,
                message: "Star not found"
            });
        }

        const { error: deleteError } = await supabase
            .from("stars")
            .delete()
            .eq("user_id", userId)
            .eq("resource_type", resourceType)
            .eq("resource_id", resourceId);

        if (deleteError) {
            return res.status(500).json({
                success: false,
                message: "Failed to unstar resource",
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: `${resourceType} unstarred successfully`,
            star
        });

    } catch (error) {
        console.error("Unstar error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});


module.exports = router;