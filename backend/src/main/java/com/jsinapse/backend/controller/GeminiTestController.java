
package com.jsinapse.backend.controller;

import com.jsinapse.backend.service.GeminiService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class GeminiTestController {

    private final GeminiService geminiService;

    public GeminiTestController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    @GetMapping("/test")
    public Map<String, String> test(
            @RequestParam(defaultValue = "Explain what a Java class is in two sentences.") String prompt
    ) throws Exception {
        return Map.of("response", geminiService.generateText(prompt));
    }
}
