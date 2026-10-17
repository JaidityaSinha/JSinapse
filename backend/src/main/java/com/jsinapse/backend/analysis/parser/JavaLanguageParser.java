
package com.jsinapse.backend.analysis.parser;

import com.github.javaparser.JavaParser;
import com.github.javaparser.ParseResult;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.ImportDeclaration;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.TypeDeclaration;
import com.github.javaparser.ast.expr.MethodCallExpr;
import com.jsinapse.backend.analysis.model.CodeGraph;
import com.jsinapse.backend.analysis.model.CodeNode;
import com.jsinapse.backend.analysis.model.CodeRelationship;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class JavaLanguageParser implements LanguageParser {

    @Override
    public String getLanguage() {
        return "java";
    }

    @Override
    public boolean supports(String filePath) {
        return filePath != null && filePath.endsWith(".java");
    }

    @Override
    public CodeGraph parse(Map<String, String> sourceFiles) {
        List<CodeNode> nodes = new ArrayList<>();
        List<CodeRelationship> relationships = new ArrayList<>();

        Map<String, String> typeIds = new LinkedHashMap<>();
        Map<String, String> simpleTypeIds = new LinkedHashMap<>();
        Map<String, String> methodIds = new LinkedHashMap<>();

        Map<String, CompilationUnit> compilationUnits = new LinkedHashMap<>();

        JavaParser parser = new JavaParser(
                new ParserConfiguration()
                        .setLanguageLevel(
                                ParserConfiguration.LanguageLevel.BLEEDING_EDGE
                        )
        );

        // First pass: parse files and create file, import, type,
        // field, and method nodes.
        for (Map.Entry<String, String> entry : sourceFiles.entrySet()) {
            String filePath = entry.getKey();
            String source = entry.getValue();

            String fileId = "file:" + filePath;

            nodes.add(new CodeNode(
                    fileId,
                    CodeNode.NodeType.FILE,
                    filePath,
                    filePath,
                    1,
                    source.split("\n", -1).length
            ));

            ParseResult<CompilationUnit> result = parser.parse(source);

            if (!result.isSuccessful() || result.getResult().isEmpty()) {
                continue;
            }

            CompilationUnit unit = result.getResult().get();
            compilationUnits.put(filePath, unit);

            for (ImportDeclaration importDeclaration : unit.getImports()) {
                String importName = importDeclaration.getNameAsString();
                String importId = "import:" + filePath + ":" + importName;

                nodes.add(new CodeNode(
                        importId,
                        CodeNode.NodeType.VARIABLE,
                        importName,
                        filePath,
                        importDeclaration.getBegin().map(p -> p.line).orElse(null),
                        importDeclaration.getEnd().map(p -> p.line).orElse(null)
                ));

                relationships.add(new CodeRelationship(
                        fileId,
                        CodeRelationship.RelationshipType.IMPORTS,
                        importId
                ));
            }

            String packageName = unit.getPackageDeclaration()
                    .map(declaration -> declaration.getNameAsString())
                    .orElse("");

            for (TypeDeclaration<?> type : unit.getTypes()) {
                if (!(type instanceof ClassOrInterfaceDeclaration declaration)) {
                    continue;
                }

                String typeName = declaration.getNameAsString();
                String qualifiedName = packageName.isEmpty()
                        ? typeName
                        : packageName + "." + typeName;

                String typeId = "type:" + filePath + ":" + typeName;

                CodeNode.NodeType nodeType = declaration.isInterface()
                        ? CodeNode.NodeType.INTERFACE
                        : CodeNode.NodeType.CLASS;

                nodes.add(new CodeNode(
                        typeId,
                        nodeType,
                        typeName,
                        filePath,
                        type.getBegin().map(p -> p.line).orElse(null),
                        type.getEnd().map(p -> p.line).orElse(null)
                ));

                typeIds.put(qualifiedName, typeId);
                typeIds.put(filePath + ":" + typeName, typeId);

                simpleTypeIds.putIfAbsent(typeName, typeId);

                relationships.add(new CodeRelationship(
                        fileId,
                        CodeRelationship.RelationshipType.CONTAINS,
                        typeId
                ));

                for (FieldDeclaration field : declaration.getFields()) {
                    field.getVariables().forEach(variable -> {
                        String fieldId = "field:" + filePath + ":"
                                + typeName + ":" + variable.getNameAsString();

                        nodes.add(new CodeNode(
                                fieldId,
                                CodeNode.NodeType.FIELD,
                                variable.getNameAsString(),
                                filePath,
                                field.getBegin().map(p -> p.line).orElse(null),
                                field.getEnd().map(p -> p.line).orElse(null)
                        ));

                        relationships.add(new CodeRelationship(
                                typeId,
                                CodeRelationship.RelationshipType.CONTAINS,
                                fieldId
                        ));
                    });
                }

                for (MethodDeclaration method : declaration.getMethods()) {
                    String methodName = method.getNameAsString();
                    int parameterCount = method.getParameters().size();

                    String methodId = "method:" + filePath + ":"
                            + typeName + ":" + methodName + ":"
                            + parameterCount;

                    nodes.add(new CodeNode(
                            methodId,
                            CodeNode.NodeType.METHOD,
                            methodName,
                            filePath,
                            method.getBegin().map(p -> p.line).orElse(null),
                            method.getEnd().map(p -> p.line).orElse(null)
                    ));

                    methodIds.put(
                            qualifiedName + ":" + methodName + ":" + parameterCount,
                            methodId
                    );

                    // Keep the first matching method as a fallback for
                    // calls where the argument count cannot be resolved.
                    methodIds.putIfAbsent(
                            qualifiedName + ":" + methodName,
                            methodId
                    );

                    relationships.add(new CodeRelationship(
                            typeId,
                            CodeRelationship.RelationshipType.CONTAINS,
                            methodId
                    ));
                }
            }
        }

        // Second pass: resolve inheritance, implementations, and method calls
        // after all nodes have been registered.
        for (Map.Entry<String, CompilationUnit> entry : compilationUnits.entrySet()) {
            String filePath = entry.getKey();
            CompilationUnit unit = entry.getValue();

            String packageName = unit.getPackageDeclaration()
                    .map(declaration -> declaration.getNameAsString())
                    .orElse("");

            for (TypeDeclaration<?> type : unit.getTypes()) {
                if (!(type instanceof ClassOrInterfaceDeclaration declaration)) {
                    continue;
                }

                String typeName = declaration.getNameAsString();
                String qualifiedName = packageName.isEmpty()
                        ? typeName
                        : packageName + "." + typeName;

                String typeId = typeIds.get(filePath + ":" + typeName);

                if (typeId == null) {
                    continue;
                }

                declaration.getExtendedTypes().forEach(parent -> {
                    String parentId = resolveTypeId(
                            parent.getNameAsString(),
                            packageName,
                            typeIds,
                            simpleTypeIds
                    );

                    if (parentId != null) {
                        relationships.add(new CodeRelationship(
                                typeId,
                                CodeRelationship.RelationshipType.EXTENDS,
                                parentId
                        ));
                    }
                });

                declaration.getImplementedTypes().forEach(parent -> {
                    String parentId = resolveTypeId(
                            parent.getNameAsString(),
                            packageName,
                            typeIds,
                            simpleTypeIds
                    );

                    if (parentId != null) {
                        relationships.add(new CodeRelationship(
                                typeId,
                                CodeRelationship.RelationshipType.IMPLEMENTS,
                                parentId
                        ));
                    }
                });

                for (MethodDeclaration method : declaration.getMethods()) {
                    String methodId = "method:" + filePath + ":"
                            + typeName + ":" + method.getNameAsString() + ":"
                            + method.getParameters().size();

                    method.findAll(MethodCallExpr.class).forEach(call -> {
                        String calledName = call.getNameAsString();
                        int argumentCount = call.getArguments().size();

                        String targetId = null;

                        // Calls such as this.save() or super.save()
                        // can be resolved against their respective types
                        // when those types exist in the analyzed source.
                        if (call.getScope().isPresent()) {
                            String scopeName = call.getScope().get().toString();

                            if (scopeName.equals("this")) {
                                targetId = methodIds.get(
                                        qualifiedName + ":" + calledName
                                                + ":" + argumentCount
                                );
                            } else if (scopeName.equals("super")) {
                                // The parent type is resolved from the
                                // inheritance relationships below where
                                // possible. Avoid guessing a target here.
                                targetId = null;
                            }
                        } else {
                            // Unqualified method calls are first checked
                            // against the current class.
                            targetId = methodIds.get(
                                    qualifiedName + ":" + calledName
                                            + ":" + argumentCount
                            );
                        }

                        if (targetId == null) {
                            return;
                        }

                        relationships.add(new CodeRelationship(
                                methodId,
                                CodeRelationship.RelationshipType.CALLS,
                                targetId
                        ));
                    });
                }
            }
        }

        return new CodeGraph(nodes, relationships);
    }

    private String resolveTypeId(
            String name,
            String packageName,
            Map<String, String> typeIds,
            Map<String, String> simpleTypeIds
    ) {
        String directMatch = typeIds.get(name);

        if (directMatch != null) {
            return directMatch;
        }

        if (!packageName.isEmpty()) {
            String packageMatch = typeIds.get(packageName + "." + name);

            if (packageMatch != null) {
                return packageMatch;
            }
        }

        // Only resolve a simple name if it uniquely identifies a type.
        // A simple-name map alone cannot establish uniqueness, so verify
        // that no other qualified type shares the same simple name.
        String candidate = simpleTypeIds.get(name);

        if (candidate == null) {
            return null;
        }

        long matchingTypes = typeIds.entrySet().stream()
                .filter(entry -> entry.getKey().endsWith("." + name))
                .map(Map.Entry::getValue)
                .distinct()
                .count();

        return matchingTypes <= 1 ? candidate : null;
    }
}
