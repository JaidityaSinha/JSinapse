
package com.jsinapse.backend.service;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class GitHubService {

    private final RestClient restClient;

    public GitHubService() {
        Dotenv dotenv = Dotenv.configure()
                .directory("./")
                .ignoreIfMissing()
                .load();

        String token = dotenv.get("GITHUB_TOKEN");

        if (token == null || token.isBlank()) {
            token = System.getenv("GITHUB_TOKEN");
        }

        RestClient.Builder builder = RestClient.builder()
                .baseUrl("https://api.github.com")
                .defaultHeader("Accept", "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28");

        if (token != null && !token.isBlank()) {
            builder.defaultHeader("Authorization", "Bearer " + token);
        }

        this.restClient = builder.build();
    }

    public Object getRepository(String owner, String repo) {
        return restClient.get()
                .uri("/repos/{owner}/{repo}", owner, repo)
                .retrieve()
                .body(Object.class);
    }

    public Object getRepositoryTree(String owner, String repo, String branch) {
        return restClient.get()
                .uri("/repos/{owner}/{repo}/git/trees/{branch}?recursive=1",
                        owner, repo, branch)
                .retrieve()
                .body(Object.class);
    }

    public String getDefaultBranch(String owner, String repo) {
        Map<String, Object> response = restClient.get()
                .uri("/repos/{owner}/{repo}", owner, repo)
                .retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {});

        return response.get("default_branch").toString();
    }

    public List<Map<String, Object>> getSourceFiles(
            String owner, String repo, String branch) {

        Map<String, Object> response = restClient.get()
                .uri("/repos/{owner}/{repo}/git/trees/{branch}?recursive=1",
                        owner, repo, branch)
                .retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {});

        List<?> tree = (List<?>) response.get("tree");

        Set<String> extensions = Set.of(
                ".java", ".py", ".js", ".jsx",
                ".ts", ".tsx", ".c", ".cpp",
                ".h", ".hpp", ".go", ".rs",
                ".rb", ".php", ".cs", ".kt",
                ".swift"
        );

        return tree.stream()
                .filter(Map.class::isInstance)
                .map(Map.class::cast)
                .filter(entry -> "blob".equals(entry.get("type")))
                .filter(entry -> {
                    Object pathValue = entry.get("path");

                    if (!(pathValue instanceof String path)) {
                        return false;
                    }

                    String lowerPath = path.toLowerCase();
                    String fileName = lowerPath.substring(
                            lowerPath.lastIndexOf('/') + 1
                    );

                    return extensions.stream().anyMatch(lowerPath::endsWith)
                            || fileName.equals("readme");
                })
                .map(entry -> {
                    Map<String, Object> result = new HashMap<>();

                    entry.forEach((key, value) -> {
                        if (key instanceof String stringKey) {
                            result.put(stringKey, value);
                        }
                    });

                    return result;
                })
                .collect(Collectors.toList());
    }

    public String getFileContent(String owner, String repo, String path) {
        Map<String, Object> response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/repos/{owner}/{repo}/contents/")
                        .path(path)
                        .build(owner, repo))
                .retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {});

        String encodedContent = (String) response.get("content");

        if (encodedContent == null) {
            throw new IllegalArgumentException(
                    "No file content returned. The path may refer to a directory or a large file.");
        }

        String cleanContent = encodedContent.replaceAll("\\s", "");
        byte[] decodedBytes = Base64.getDecoder().decode(cleanContent);

        return new String(decodedBytes, StandardCharsets.UTF_8);
    }
}
