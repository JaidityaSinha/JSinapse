
package com.jsinapse.backend.analysis.model;

import java.util.List;

public record CodeGraph(
        List<CodeNode> nodes,
        List<CodeRelationship> relationships
) {
}
