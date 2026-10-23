
package com.jsinapse.backend.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class CodeSearchService {

    private static final int MAX_FILES_TO_SCAN = 100;
    private static final int MAX_MATCHES = 100;
    private static final int MAX_QUERY_LENGTH = 200;

    private final GitHubService gitHubService;

    public CodeSearchService(GitHubService gitHubService) {
        this.gitHubService = gitHubService;
    }

    public Map<String, Object> search(
            String owner,
            String repo,
            String query,
            boolean caseSensitive,
            String extension
    ) {
        if (owner == null || owner.isBlank()
                || repo == null || repo.isBlank()) {
            throw new IllegalArgumentException(
                    "Repository owner and name are required."
            );
        }

        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException(
                    "Search query cannot be empty."
            );
        }

        query = query.trim();

        if (query.length() > MAX_QUERY_LENGTH) {
            throw new IllegalArgumentException(
                    "Search query cannot exceed 200 characters."
            );
        }

        String branch = gitHubService.getDefaultBranch(owner, repo);

        List<Map<String, Object>> sourceFiles =
                gitHubService.getSourceFiles(owner, repo, branch);

        String normalizedExtension = normalizeExtension(extension);

        List<Map<String, Object>> matches = new ArrayList<>();
        int scannedFiles = 0;
        boolean truncated = false;

        for (Map<String, Object> file : sourceFiles) {
            Object pathValue = file.get("path");

            if (!(pathValue instanceof String path)) {
                continue;
            }

            if (!matchesExtension(path, normalizedExtension)) {
                continue;
            }

            if (scannedFiles >= MAX_FILES_TO_SCAN) {
                truncated = true;
                break;
            }

            scannedFiles++;

            String content = gitHubService.getFileContent(
                    owner, repo, path
            );

            String[] lines = content.split("\\R", -1);

            for (int i = 0; i < lines.length; i++) {
                String line = lines[i];

                boolean found;

                if (caseSensitive) {
                    found = line.contains(query);
                } else {
                    found = line.toLowerCase(Locale.ROOT)
                            .contains(query.toLowerCase(Locale.ROOT));
                }

                if (!found) {
                    continue;
                }

                Map<String, Object> match = new HashMap<>();
                match.put("path", path);
                match.put("lineNumber", i + 1);
                match.put("line", line.trim());

                matches.add(match);

                if (matches.size() >= MAX_MATCHES) {
                    truncated = true;
                    break;
                }
            }

            if (matches.size() >= MAX_MATCHES) {
                break;
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("query", query);
        response.put("matches", matches);
        response.put("matchCount", matches.size());
        response.put("scannedFiles", scannedFiles);
        response.put("truncated", truncated);

        return response;
    }

    private String normalizeExtension(String extension) {
        if (extension == null || extension.isBlank()) {
            return "";
        }

        String normalized = extension.trim().toLowerCase(Locale.ROOT);

        return normalized.startsWith(".")
                ? normalized
                : "." + normalized;
    }

    private boolean matchesExtension(String path, String extension) {
        return extension.isEmpty()
                || path.toLowerCase(Locale.ROOT).endsWith(extension);
    }
}
