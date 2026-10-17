
package com.jsinapse.backend.controller;

import com.jsinapse.backend.analysis.CodeAnalysisService;
import com.jsinapse.backend.analysis.model.CodeGraph;
import com.jsinapse.backend.service.GitHubService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/analysis")
public class CodeAnalysisController {

    private final GitHubService gitHubService;
    private final CodeAnalysisService codeAnalysisService;

    public CodeAnalysisController(
            GitHubService gitHubService,
            CodeAnalysisService codeAnalysisService
    ) {
        this.gitHubService = gitHubService;
        this.codeAnalysisService = codeAnalysisService;
    }

    @GetMapping("/graph")
    public CodeGraph analyzeRepository(
            @RequestParam String owner,
            @RequestParam String repo
    ) {
        String branch = gitHubService.getDefaultBranch(owner, repo);

        List<Map<String, Object>> files =
                gitHubService.getSourceFiles(owner, repo, branch);

        Map<String, String> sourceFiles = new LinkedHashMap<>();

        for (Map<String, Object> file : files) {
            Object pathValue = file.get("path");

            if (pathValue == null) {
                continue;
            }

            String path = pathValue.toString();

            if (path.endsWith(".java")) {
                String content =
                        gitHubService.getFileContent(owner, repo, path);

                sourceFiles.put(path, content);
            }
        }

        return codeAnalysisService.analyze(sourceFiles);
    }
}
