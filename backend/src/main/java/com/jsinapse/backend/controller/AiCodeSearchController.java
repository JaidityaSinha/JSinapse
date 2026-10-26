
package com.jsinapse.backend.controller;

import com.jsinapse.backend.service.AiCodeSearchService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiCodeSearchController {

    private final AiCodeSearchService aiCodeSearchService;

    public AiCodeSearchController(
            AiCodeSearchService aiCodeSearchService
    ) {
        this.aiCodeSearchService = aiCodeSearchService;
    }

    @GetMapping("/search")
    public Map<String, Object> search(
            @RequestParam String owner,
            @RequestParam String repo,
            @RequestParam String question
    ) {
        try {
            return aiCodeSearchService.ask(owner, repo, question);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    e.getMessage(),
                    e
            );
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "AI code search failed. Check the backend logs.",
                    e
            );
        }
    }
}
