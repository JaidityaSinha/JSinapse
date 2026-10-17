package com.jsinapse.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class GitHubService {
    private final RestClient restClient;

    public GitHubService() {
        this.restClient = RestClient.builder()
                .baseUrl("https://api.github.com")
                .defaultHeader("Accept", "application/vnd.github+json")
                .build();
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
        return restClient.get()
                .uri("/repos/{owner}/{repo}", owner, repo)
                .retrieve()
                .body(java.util.Map.class)
                .get("default_branch")
                .toString();
    }


    public List<Map<String, Object>> getSourceFiles(
            String owner, String repo, String branch) {


        Map<String, Object> response = restClient.get()
                .uri("/repos/{owner}/{repo}/git/trees/{branch}?recursive=1",
                        owner, repo, branch)
                .retrieve()
                .body(new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {});

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

                    return extensions.stream().anyMatch(path::endsWith);
                })

                .map(entry -> {
                    Map<String, Object> result = new java.util.HashMap<>();

                    entry.forEach((key, value) -> {
                        if (key instanceof String stringKey) {
                            result.put(stringKey, value);
                        }
                    });

                    return result;
                })
                .collect(Collectors.toList());


    }



}
