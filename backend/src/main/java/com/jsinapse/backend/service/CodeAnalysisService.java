
package com.jsinapse.backend.service;

import com.jsinapse.backend.analysis.model.CodeGraph;
import com.jsinapse.backend.analysis.parser.LanguageParser;
import com.jsinapse.backend.analysis.parser.JavaLanguageParser;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class CodeAnalysisService {

    private final List<LanguageParser> parsers;

    public CodeAnalysisService() {
        this.parsers = List.of(
                new JavaLanguageParser()
        );
    }

    public CodeGraph analyze(Map<String, String> sourceFiles) {
        List<com.jsinapse.backend.analysis.model.CodeNode> nodes =
                new ArrayList<>();
        List<com.jsinapse.backend.analysis.model.CodeRelationship> relationships =
                new ArrayList<>();

        Map<LanguageParser, Map<String, String>> filesByParser =
                new LinkedHashMap<>();

        for (Map.Entry<String, String> entry : sourceFiles.entrySet()) {
            for (LanguageParser parser : parsers) {
                if (parser.supports(entry.getKey())) {
                    filesByParser
                            .computeIfAbsent(parser, ignored -> new LinkedHashMap<>())
                            .put(entry.getKey(), entry.getValue());
                    break;
                }
            }
        }

        for (Map.Entry<LanguageParser, Map<String, String>> entry
                : filesByParser.entrySet()) {
            CodeGraph graph = entry.getKey().parse(entry.getValue());
            nodes.addAll(graph.nodes());
            relationships.addAll(graph.relationships());
        }

        return new CodeGraph(nodes, relationships);
    }
}
