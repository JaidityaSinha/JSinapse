
package com.jsinapse.backend.service;

import com.jsinapse.backend.analysis.model.CodeGraph;
import com.jsinapse.backend.analysis.model.CodeNode;
import com.jsinapse.backend.analysis.model.CodeRelationship;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CallChainService {

    public Map<String, Object> trace(
            CodeGraph graph,
            String methodId
    ) {
        CodeNode selectedMethod = graph.nodes().stream()
                .filter(node -> node.id().equals(methodId))
                .findFirst()
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Method not found: " + methodId
                        )
                );

        if (selectedMethod.type() != CodeNode.NodeType.METHOD
                && selectedMethod.type() != CodeNode.NodeType.FUNCTION) {
            throw new IllegalArgumentException(
                    "Selected node is not a method or function"
            );
        }

        Map<String, CodeNode> nodesById = graph.nodes().stream()
                .collect(Collectors.toMap(
                        CodeNode::id,
                        node -> node,
                        (first, second) -> first
                ));

        List<CodeNode> calls = graph.relationships().stream()
                .filter(rel ->
                        rel.type() == CodeRelationship.RelationshipType.CALLS
                )
                .filter(rel -> rel.sourceId().equals(methodId))
                .map(rel -> nodesById.get(rel.targetId()))
                .filter(node -> node != null)
                .distinct()
                .toList();

        List<CodeNode> calledBy = graph.relationships().stream()
                .filter(rel ->
                        rel.type() == CodeRelationship.RelationshipType.CALLS
                )
                .filter(rel -> rel.targetId().equals(methodId))
                .map(rel -> nodesById.get(rel.sourceId()))
                .filter(node -> node != null)
                .distinct()
                .toList();

        return Map.of(
                "method", selectedMethod,
                "calls", calls,
                "calledBy", calledBy
        );
    }
}
