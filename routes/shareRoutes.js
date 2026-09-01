const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");
const authMiddleware = require("../middleware/authMiddleware");

// 1. SHARE FILE / FOLDER

router.post("/", authMiddleware, async (req, res) => {
    try {
        const {
            resourceType,
            resourceId,
            granteeUserId,
            role
        } = req.body;

        const createdBy = req.user.id;

        // Validate
        if (
            !resourceType ||
            !resourceId ||
            !granteeUserId ||
            !role
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "resourceType, resourceId, granteeUserId and role are required"
            });
        }

        if (!["file", "folder"].includes(resourceType)) {
            return res.status(400).json({
                success: false,
                message: "resourceType must be file or folder"
            });
        }

        if (!["viewer", "editor"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "role must be viewer or editor"
            });
        }

        // Owner cannot share with himself
        if (createdBy === granteeUserId) {
            return res.status(400).json({
                success: false,
                message: "Owner cannot share resource with himself"
            });
        }

        const table =
            resourceType === "file"
                ? "files"
                : "folders";

        // Check resource
        const {
            data: resource,
            error: resourceError
        } = await supabase
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

        // Only owner can share
        if (resource.owner_id !== createdBy) {
            return res.status(403).json({
                success: false,
                message: "Only the owner can share this resource"
            });
        }

        // Check whether user exists
        const {
            data: grantee,
            error: granteeError
        } = await supabase
            .from("users")
            .select("id, name, email")
            .eq("id", granteeUserId)
            .maybeSingle();

        if (granteeError) {
            return res.status(500).json({
                success: false,
                message: granteeError.message
            });
        }

        if (!grantee) {
            return res.status(404).json({
                success: false,
                message: "User to share with not found"
            });
        }

        // Check existing share
        const {
            data: existingShare,
            error: existingError
        } = await supabase
            .from("shares")
            .select("*")
            .eq("resource_type", resourceType)
            .eq("resource_id", resourceId)
            .eq("grantee_user_id", granteeUserId)
            .maybeSingle();

        if (existingError) {
            return res.status(500).json({
                success: false,
                message: existingError.message
            });
        }

        // Update existing permission
        if (existingShare) {

            const {
                data: updatedShare,
                error: updateError
            } = await supabase
                .from("shares")
                .update({
                    role: role
                })
                .eq("id", existingShare.id)
                .select()
                .single();

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to update permission",
                    error: updateError.message
                });
            }

            return res.json({
                success: true,
                message: "Permission updated successfully",
                share: updatedShare
            });
        }

        // Create new share
        const {
            data: share,
            error: shareError
        } = await supabase
            .from("shares")
            .insert({
                resource_type: resourceType,
                resource_id: resourceId,
                grantee_user_id: granteeUserId,
                role: role,
                created_by: createdBy
            })
            .select()
            .single();

        if (shareError) {
            return res.status(500).json({
                success: false,
                message: "Failed to share resource",
                error: shareError.message
            });
        }

        res.status(201).json({
            success: true,
            message: `${resourceType} shared successfully`,
            share
        });

    } catch (error) {
        console.error("Share error:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

// 2. CHECK USER PERMISSION

router.get(
    "/permission/:resourceType/:resourceId/:userId",
    authMiddleware,
    async (req, res) => {

        try {

            const {
                resourceType,
                resourceId,
                userId
            } = req.params;

            if (!["file", "folder"].includes(resourceType)) {
                return res.status(400).json({
                    success: false,
                    message: "resourceType must be file or folder"
                });
            }

            const table =
                resourceType === "file"
                    ? "files"
                    : "folders";

            // Get resource
            const {
                data: resource,
                error: resourceError
            } = await supabase
                .from(table)
                .select("id, owner_id, is_deleted")
                .eq("id", resourceId)
                .single();

            if (resourceError || !resource) {
                return res.status(404).json({
                    success: false,
                    message: `${resourceType} not found`
                });
            }

            if (resource.is_deleted) {
                return res.status(404).json({
                    success: false,
                    message: `${resourceType} not found`
                });
            }

            // OWNER
            if (resource.owner_id === userId) {

                return res.json({
                    success: true,
                    resourceType,
                    resourceId,
                    userId,
                    role: "owner",
                    canView: true,
                    canEdit: true,
                    canDelete: true,
                    canShare: true
                });
            }

            // Check shared permission
            const {
                data: share,
                error: shareError
            } = await supabase
                .from("shares")
                .select("*")
                .eq("resource_type", resourceType)
                .eq("resource_id", resourceId)
                .eq("grantee_user_id", userId)
                .maybeSingle();

            if (shareError) {
                return res.status(500).json({
                    success: false,
                    message: shareError.message
                });
            }

            // No permission
            if (!share) {

                return res.json({
                    success: true,
                    resourceType,
                    resourceId,
                    userId,
                    role: "none",
                    canView: false,
                    canEdit: false,
                    canDelete: false,
                    canShare: false
                });
            }

            // VIEWER
            if (share.role === "viewer") {

                return res.json({
                    success: true,
                    resourceType,
                    resourceId,
                    userId,
                    role: "viewer",
                    canView: true,
                    canEdit: false,
                    canDelete: false,
                    canShare: false
                });
            }

            // EDITOR
            if (share.role === "editor") {

                return res.json({
                    success: true,
                    resourceType,
                    resourceId,
                    userId,
                    role: "editor",
                    canView: true,
                    canEdit: true,
                    canDelete: false,
                    canShare: false
                });
            }

            // Unknown role
            return res.json({
                success: true,
                resourceType,
                resourceId,
                userId,
                role: "none",
                canView: false,
                canEdit: false,
                canDelete: false,
                canShare: false
            });

        } catch (error) {

            console.error(
                "Permission check error:",
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

// 3. GET ALL SHARES FOR FILE / FOLDER

router.get(
    "/:resourceType/:resourceId",
    authMiddleware,
    async (req, res) => {

        try {

            const {
                resourceType,
                resourceId
            } = req.params;

            if (!["file", "folder"].includes(resourceType)) {
                return res.status(400).json({
                    success: false,
                    message: "resourceType must be file or folder"
                });
            }

            const {
                data,
                error
            } = await supabase
                .from("shares")
                .select("*")
                .eq("resource_type", resourceType)
                .eq("resource_id", resourceId);

            if (error) {

                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch shares",
                    error: error.message
                });
            }

            res.json({
                success: true,
                resourceType,
                resourceId,
                shares: data || []
            });

        } catch (error) {

            console.error(
                "Get shares error:",
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

// 4. GET SHARED WITH ME

router.get(
    "/shared-with-me/:userId",
    authMiddleware,
    async (req, res) => {

        try {

            const { userId } = req.params;

            const {
                data: shares,
                error: sharesError
            } = await supabase
                .from("shares")
                .select("*")
                .eq("grantee_user_id", userId);

            if (sharesError) {

                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch shared resources",
                    error: sharesError.message
                });
            }

            const files = [];
            const folders = [];

            for (const share of shares || []) {

                if (share.resource_type === "file") {

                    const {
                        data: file
                    } = await supabase
                        .from("files")
                        .select("*")
                        .eq("id", share.resource_id)
                        .eq("is_deleted", false)
                        .maybeSingle();

                    if (file) {

                        files.push({
                            ...file,
                            share_id: share.id,
                            role: share.role,
                            shared_by: share.created_by,
                            shared_at: share.created_at
                        });
                    }
                }

                if (share.resource_type === "folder") {

                    const {
                        data: folder
                    } = await supabase
                        .from("folders")
                        .select("*")
                        .eq("id", share.resource_id)
                        .eq("is_deleted", false)
                        .maybeSingle();

                    if (folder) {

                        folders.push({
                            ...folder,
                            share_id: share.id,
                            role: share.role,
                            shared_by: share.created_by,
                            shared_at: share.created_at
                        });
                    }
                }
            }

            res.json({
                success: true,
                userId,
                total: files.length + folders.length,
                files,
                folders
            });

        } catch (error) {

            console.error(
                "Shared with me error:",
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

// 5. REVOKE USER SHARE

router.delete(
    "/:id",
    authMiddleware,
    async (req, res) => {

        try {

            const { id } = req.params;

            const {
                data: share,
                error: findError
            } = await supabase
                .from("shares")
                .select("*")
                .eq("id", id)
                .single();

            if (findError || !share) {

                return res.status(404).json({
                    success: false,
                    message: "Share not found"
                });
            }

            // Only creator/owner can revoke
            if (share.created_by !== req.user.id) {

                return res.status(403).json({
                    success: false,
                    message: "Only the owner can revoke this share"
                });
            }

            const {
                error: deleteError
            } = await supabase
                .from("shares")
                .delete()
                .eq("id", id);

            if (deleteError) {

                return res.status(500).json({
                    success: false,
                    message: "Failed to revoke share",
                    error: deleteError.message
                });
            }

            res.json({
                success: true,
                message: "Share access revoked successfully"
            });

        } catch (error) {

            console.error(
                "Revoke share error:",
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


module.exports = router;