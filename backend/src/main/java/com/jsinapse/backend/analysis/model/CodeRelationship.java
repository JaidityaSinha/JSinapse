
package com.jsinapse.backend.analysis.model;

public record CodeRelationship(
        String sourceId,
        RelationshipType type,
        String targetId
) {
    public enum RelationshipType {
        CONTAINS,
        IMPORTS,
        CALLS,
        EXTENDS,
        IMPLEMENTS,
        REFERENCES,
        DEPENDS_ON,
        OVERRIDES,
        DISPATCHES_TO
    }
}
