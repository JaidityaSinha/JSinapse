
package com.jsinapse.backend.controller;

import com.jsinapse.backend.service.CodeSearchService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/code-search")
public class CodeSearchController {

    private final CodeSearchService codeSearchService;

    public CodeSearchController(CodeSearchService codeSearchService) {
        this.codeSearchService = codeSearchService;
    }

    @GetMapping
    public Map<String, Object> search(
            @RequestParam String owner,
            @RequestParam String repo,
            @RequestParam String query,
            @RequestParam(defaultValue = "false") boolean caseSensitive,
            @RequestParam(required = false) String extension
    ) {
        try {
            return codeSearchService.search(
                    owner,
                    repo,
                    query,
                    caseSensitive,
                    extension
            );
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    e.getMessage(),
                    e
            );
        }
    }
}
