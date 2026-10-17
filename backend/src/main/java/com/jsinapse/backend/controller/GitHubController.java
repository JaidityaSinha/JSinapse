
package com.jsinapse.backend.controller;

import com.jsinapse.backend.service.GitHubService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/github")
@CrossOrigin(origins = "http://localhost:5173")
public class GitHubController {

    private final GitHubService gitHubService;

    public GitHubController(GitHubService gitHubService) {
        this.gitHubService = gitHubService;
    }

    @GetMapping("/repository")
    public Object getRepository(
            @RequestParam String owner,
            @RequestParam String repo) {
        return gitHubService.getRepository(owner, repo);
    }
}
