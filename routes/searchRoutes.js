const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// SEARCH FILES + FOLDERS
router.get("/", async (req, res) => {
    try {
        const {
            q,
            type,
            ownerId,
            sortBy = "created_at",
            order = "desc",
            page = 1,
            limit = 10
        } = req.query;

        // ownerId required
        if (!ownerId) {
            return res.status(400).json({
                success: false,
                message: "ownerId is required"
            });
        }

        // Pagination
        const pageNumber = Math.max(
            parseInt(page) || 1,
            1
        );

        const limitNumber = Math.min(
            Math.max(parseInt(limit) || 10, 1),
            100
        );

        const from = (pageNumber - 1) * limitNumber;
        const to = from + limitNumber - 1;

        // Allowed sorting columns
        const allowedSortFields = [
            "name",
            "size_bytes",
            "created_at",
            "updated_at"
        ];

        const finalSortBy =
            allowedSortFields.includes(sortBy)
                ? sortBy
                : "created_at";

        const ascending =
            String(order).toLowerCase() === "asc";

        // ==========================================
        // FILE QUERY
        // ==========================================

        let files = [];
        let fileCount = 0;

        /*
         * If search query exists,
         * use PostgreSQL Full-Text Search RPC.
         */
        if (q && q.trim() !== "") {

            const {
                data: searchFiles,
                error: searchError
            } = await supabase.rpc(
                "search_files_full_text",
                {
                    search_user_id: ownerId,
                    search_query: q.trim()
                }
            );

            if (searchError) {
                console.error(
                    "Full-text search error:",
                    searchError
                );

                return res.status(500).json({
                    success: false,
                    message: "Full-text search failed",
                    error: searchError.message
                });
            }

            files = searchFiles || [];

            // Apply file type filter
            if (type && type.trim() !== "") {

                const fileType =
                    type.trim().toLowerCase();

                const mimeTypes = {
                    pdf: "application/pdf",

                    doc: "application/msword",

                    docx:
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

                    xls: "application/vnd.ms-excel",

                    xlsx:
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

                    png: "image/png",

                    jpg: "image/jpeg",

                    jpeg: "image/jpeg",

                    gif: "image/gif",

                    txt: "text/plain"
                };

                if (mimeTypes[fileType]) {
                    files = files.filter(
                        file =>
                            file.mime_type ===
                            mimeTypes[fileType]
                    );
                }
            }

            // Sort
            files.sort((a, b) => {

                let valueA = a[finalSortBy];
                let valueB = b[finalSortBy];

                if (valueA == null) valueA = "";
                if (valueB == null) valueB = "";

                if (valueA < valueB) {
                    return ascending ? -1 : 1;
                }

                if (valueA > valueB) {
                    return ascending ? 1 : -1;
                }

                return 0;
            });

            fileCount = files.length;

            // Pagination
            files = files.slice(
                from,
                to + 1
            );

        } else {

            /*
             * No search query:
             * normal database query.
             */
            let fileQuery = supabase
                .from("files")
                .select("*", {
                    count: "exact"
                })
                .eq("owner_id", ownerId)
                .eq("is_deleted", false);

            // File type filter
            if (type && type.trim() !== "") {

                const fileType =
                    type.trim().toLowerCase();

                const mimeTypes = {
                    pdf: "application/pdf",

                    doc: "application/msword",

                    docx:
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

                    xls: "application/vnd.ms-excel",

                    xlsx:
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

                    png: "image/png",

                    jpg: "image/jpeg",

                    jpeg: "image/jpeg",

                    gif: "image/gif",

                    txt: "text/plain"
                };

                if (mimeTypes[fileType]) {
                    fileQuery = fileQuery.eq(
                        "mime_type",
                        mimeTypes[fileType]
                    );
                }
            }

            fileQuery = fileQuery
                .order(finalSortBy, {
                    ascending: ascending
                })
                .range(from, to);

            const {
                data,
                error,
                count
            } = await fileQuery;

            if (error) {
                console.error(
                    "File search error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: "File search failed",
                    error: error.message
                });
            }

            files = data || [];
            fileCount = count || 0;
        }

        // ==========================================
        // FOLDER QUERY
        // ==========================================

        let folderQuery = supabase
            .from("folders")
            .select("*", {
                count: "exact"
            })
            .eq("owner_id", ownerId)
            .eq("is_deleted", false);

        // Folder name search
        if (q && q.trim() !== "") {
            folderQuery = folderQuery.ilike(
                "name",
                `%${q.trim()}%`
            );
        }

        // Folder sorting
        folderQuery = folderQuery
            .order(
                finalSortBy === "size_bytes"
                    ? "created_at"
                    : finalSortBy,
                {
                    ascending: ascending
                }
            )
            .range(from, to);

        const {
            data: folders,
            error: folderError,
            count: folderCount
        } = await folderQuery;

        if (folderError) {
            console.error(
                "Folder search error:",
                folderError
            );

            return res.status(500).json({
                success: false,
                message: "Folder search failed",
                error: folderError.message
            });
        }

        // ==========================================
        // TOTAL RESULTS
        // ==========================================

        const totalFiles = fileCount || 0;
        const totalFolders = folderCount || 0;

        const totalItems =
            totalFiles + totalFolders;

        const totalPages =
            Math.ceil(
                totalItems / limitNumber
            );

        // ==========================================
        // RESPONSE
        // ==========================================

        res.json({
            success: true,

            search: {
                query: q || "",
                type: type || null
            },

            sort: {
                sortBy: finalSortBy,
                order: ascending
                    ? "asc"
                    : "desc"
            },

            pagination: {
                page: pageNumber,
                limit: limitNumber,
                totalItems,
                totalFiles,
                totalFolders,
                totalPages,

                hasNextPage:
                    pageNumber < totalPages,

                hasPreviousPage:
                    pageNumber > 1
            },

            results: {
                files: files || [],
                folders: folders || []
            }
        });

    } catch (error) {

        console.error(
            "Search server error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

module.exports = router;