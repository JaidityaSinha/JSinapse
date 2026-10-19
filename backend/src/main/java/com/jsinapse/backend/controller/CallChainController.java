
package com.jsinapse.backend.controller;

import com.jsinapse.backend.analysis.model.CodeGraph;
import com.jsinapse.backend.service.CallChainService;
import com.jsinapse.backend.service.CodeAnalysisService;
import com.jsinapse.backend.service.GitHubService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import com.jsinapse.backend.service.CallChainService;
import com.jsinapse.backend.service.CodeAnalysisService;
import com.jsinapse.backend.service.GitHubService;

import java.util.Map;

@RestController
public class CallChainController {

    private final CodeAnalysisService codeAnalysisService;
    private final CallChainService callChainService;
    private final GitHubService gitHubService;

    public CallChainController(
            CodeAnalysisService codeAnalysisService,
            CallChainService callChainService,
            GitHubService gitHubService
    ) {
        this.codeAnalysisService = codeAnalysisService;
        this.callChainService = callChainService;
        this.gitHubService = gitHubService;
    }

    @GetMapping("/api/analysis/call-chain")
    public Map<String, Object> traceCallChain(
            @RequestParam String owner,
            @RequestParam String repo,
            @RequestParam String methodId
    ) {
        try {
            String branch = gitHubService.getDefaultBranch(owner, repo);

            Map<String, String> sourceFiles = new java.util.LinkedHashMap<>();

            for (Map<String, Object> file :
                    gitHubService.getSourceFiles(owner, repo, branch)) {
                String path = (String) file.get("path");
                if (path != null) {
                    sourceFiles.put(
                            path,
                            gitHubService.getFileContent(owner, repo, path)
                    );
                }
            }

            CodeGraph graph = codeAnalysisService.analyze(sourceFiles);

            return callChainService.trace(graph, methodId);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    exception.getMessage(),
                    exception
            );
        }
    }
}
