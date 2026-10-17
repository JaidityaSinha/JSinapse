
package com.jsinapse.backend.analysis.model;

public record CodeNode(
        String id,
        NodeType type,
        String name,
        String filePath,
        Integer startLine,
        Integer endLine
) {
    public enum NodeType {
        FILE,
        CLASS,
        INTERFACE,
        METHOD,
        FUNCTION,
        FIELD,
        VARIABLE
    }
}
