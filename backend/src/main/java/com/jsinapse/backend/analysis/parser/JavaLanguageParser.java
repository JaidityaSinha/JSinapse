
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
import com.github.javaparser.ast.type.Type;
import com.jsinapse.backend.analysis.model.CodeGraph;
import com.jsinapse.backend.analysis.model.CodeNode;
import com.jsinapse.backend.analysis.model.CodeRelationship;
import com.github.javaparser.ast.body.VariableDeclarator;
import com.github.javaparser.ast.body.ConstructorDeclaration;
import com.github.javaparser.ast.expr.ObjectCreationExpr;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
        Map<String, String> constructorIds = new LinkedHashMap<>();
        Map<String, CompilationUnit> compilationUnits = new LinkedHashMap<>();
        Map<String, Map<String, String>> fieldTypesByClass =
                new LinkedHashMap<>();

        JavaParser parser = new JavaParser(
                new ParserConfiguration().setLanguageLevel(
                        ParserConfiguration.LanguageLevel.BLEEDING_EDGE
                )
        );

        // Pass 1: create nodes and register types, methods, and fields.
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

                Map<String, String> fieldTypes = new LinkedHashMap<>();
                fieldTypesByClass.put(qualifiedName, fieldTypes);

                for (FieldDeclaration field : declaration.getFields()) {
                    Type fieldType = field.getElementType();
                    String fieldTypeName = fieldType.asString();

                    field.getVariables().forEach(variable -> {
                        String fieldName = variable.getNameAsString();
                        String fieldId = "field:" + filePath + ":"
                                + typeName + ":" + fieldName;

                        nodes.add(new CodeNode(
                                fieldId,
                                CodeNode.NodeType.FIELD,
                                fieldName,
                                filePath,
                                field.getBegin().map(p -> p.line).orElse(null),
                                field.getEnd().map(p -> p.line).orElse(null)
                        ));

                        relationships.add(new CodeRelationship(
                                typeId,
                                CodeRelationship.RelationshipType.CONTAINS,
                                fieldId
                        ));

                        fieldTypes.put(fieldName, fieldTypeName);
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
                            qualifiedName + ":" + methodName + ":"
                                    + parameterCount,
                            methodId
                    );

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

                for (ConstructorDeclaration constructor : declaration.getConstructors()) {
                    String constructorName = constructor.getNameAsString();
                    int parameterCount = constructor.getParameters().size();

                    String constructorId = "constructor:" + filePath + ":"
                            + typeName + ":" + parameterCount;

                    nodes.add(new CodeNode(
                            constructorId,
                            CodeNode.NodeType.METHOD,
                            constructorName + "(constructor)",
                            filePath,
                            constructor.getBegin().map(p -> p.line).orElse(null),
                            constructor.getEnd().map(p -> p.line).orElse(null)
                    ));

                    constructorIds.put(
                            qualifiedName + ":" + parameterCount,
                            constructorId
                    );

                    relationships.add(new CodeRelationship(
                            typeId,
                            CodeRelationship.RelationshipType.CONTAINS,
                            constructorId
                    ));
                }
            }
        }

        // Pass 2: resolve inheritance and method calls.
        for (Map.Entry<String, CompilationUnit> entry
                : compilationUnits.entrySet()) {
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

                Map<String, String> fieldTypes = fieldTypesByClass
                        .getOrDefault(qualifiedName, Map.of());

                for (MethodDeclaration method : declaration.getMethods()) {
                    String methodId = "method:" + filePath + ":"
                            + typeName + ":" + method.getNameAsString()
                            + ":" + method.getParameters().size();

                    Set<String> resolvedTargets = new LinkedHashSet<>();

                    method.findAll(ObjectCreationExpr.class).forEach(creation -> {
                        String createdType = creation.getType().getNameAsString();
                        int argumentCount = creation.getArguments().size();

                        String targetType = resolveTypeName(
                                createdType,
                                packageName,
                                unit,
                                typeIds,
                                simpleTypeIds
                        );

                        if (targetType != null) {
                            String constructorId = constructorIds.get(
                                    targetType + ":" + argumentCount
                            );

                            if (constructorId != null && resolvedTargets.add(constructorId)) {
                                relationships.add(new CodeRelationship(
                                        methodId,
                                        CodeRelationship.RelationshipType.CALLS,
                                        constructorId
                                ));
                            }
                        }
                    });

                    Map<String, String> localVariableTypes = new LinkedHashMap<>();

                    method.findAll(VariableDeclarator.class).forEach(variable ->
                            localVariableTypes.put(
                                    variable.getNameAsString(),
                                    variable.getType().asString()
                            )
                    );

                    method.findAll(MethodCallExpr.class).forEach(call -> {
                        String calledName = call.getNameAsString();
                        int argumentCount = call.getArguments().size();
                        String targetId = null;

                        if (call.getScope().isEmpty()) {
                            targetId = methodIds.get(
                                    qualifiedName + ":" + calledName
                                            + ":" + argumentCount
                            );

                            if (targetId == null) {
                                targetId = methodIds.get(
                                        qualifiedName + ":" + calledName
                                );
                            }
                        } else {
                            String scopeName = call.getScope().get().toString();

                            if (scopeName.equals("this")) {
                                targetId = methodIds.get(
                                        qualifiedName + ":" + calledName
                                                + ":" + argumentCount
                                );

                                if (targetId == null) {
                                    targetId = methodIds.get(
                                            qualifiedName + ":" + calledName
                                    );
                                }
                            } else if (scopeName.equals("super")) {
                                // Parent method resolution will be added later.
                            } else {
                                String fieldType = localVariableTypes.get(scopeName);

                                if (fieldType == null) {
                                    fieldType = fieldTypes.get(scopeName);
                                }

                                if (fieldType != null) {
                                    String targetType = resolveTypeName(
                                            fieldType,
                                            packageName,
                                            unit,
                                            typeIds,
                                            simpleTypeIds
                                    );

                                    if (targetType != null) {
                                        targetId = methodIds.get(
                                                targetType + ":" + calledName
                                                        + ":" + argumentCount
                                        );

                                        if (targetId == null) {
                                            targetId = methodIds.get(
                                                    targetType + ":" + calledName
                                            );
                                        }
                                    }
                                } else {
                                    String targetType = resolveTypeName(
                                            scopeName,
                                            packageName,
                                            unit,
                                            typeIds,
                                            simpleTypeIds
                                    );

                                    if (targetType != null) {
                                        targetId = methodIds.get(
                                                targetType + ":" + calledName
                                                        + ":" + argumentCount
                                        );

                                        if (targetId == null) {
                                            targetId = methodIds.get(
                                                    targetType + ":" + calledName
                                            );
                                        }
                                    }
                                }
                            }
                        }

                        if (targetId != null && resolvedTargets.add(targetId)) {
                            relationships.add(new CodeRelationship(
                                    methodId,
                                    CodeRelationship.RelationshipType.CALLS,
                                    targetId
                            ));
                        }
                    });
                }
            }
        }

        return new CodeGraph(nodes, relationships);
    }

    private String resolveTypeName(
            String name,
            String packageName,
            CompilationUnit unit,
            Map<String, String> typeIds,
            Map<String, String> simpleTypeIds
    ) {
        String cleanedName = name.replaceAll("<.*>", "").trim();

        if (typeIds.containsKey(cleanedName)) {
            return cleanedName;
        }

        String samePackage = packageName.isEmpty()
                ? cleanedName
                : packageName + "." + cleanedName;

        if (typeIds.containsKey(samePackage)) {
            return samePackage;
        }

        for (ImportDeclaration declaration : unit.getImports()) {
            if (!declaration.isAsterisk()
                    && declaration.getNameAsString().endsWith("." + cleanedName)) {
                String importedName = declaration.getNameAsString();

                if (typeIds.containsKey(importedName)) {
                    return importedName;
                }
            }
        }

        String candidateId = simpleTypeIds.get(cleanedName);
        if (candidateId == null) {
            return null;
        }

        long matches = typeIds.entrySet().stream()
                .filter(entry -> entry.getKey().endsWith("." + cleanedName))
                .map(Map.Entry::getValue)
                .distinct()
                .count();

        if (matches > 1) {
            return null;
        }

        for (Map.Entry<String, String> entry : typeIds.entrySet()) {
            if (entry.getValue().equals(candidateId)
                    && !entry.getKey().contains(":")) {
                return entry.getKey();
            }
        }

        return null;
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
