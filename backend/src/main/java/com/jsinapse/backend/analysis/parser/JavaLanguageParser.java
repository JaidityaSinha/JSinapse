
package com.jsinapse.backend.analysis.parser;

import com.github.javaparser.JavaParser;
import com.github.javaparser.ParseResult;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.TypeDeclaration;
import com.github.javaparser.ast.expr.MethodCallExpr;
import com.github.javaparser.ast.ImportDeclaration;
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
        Map<String, String> methodIds = new LinkedHashMap<>();

        JavaParser parser = new JavaParser(
                new ParserConfiguration()
                        .setLanguageLevel(ParserConfiguration.LanguageLevel.BLEEDING_EDGE)
        );

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

            for (ImportDeclaration importDeclaration : unit.getImports()) {
                String importName = importDeclaration.getNameAsString();
                String importId = "import:" + importName;

                nodes.add(new CodeNode(
                        importId,
                        CodeNode.NodeType.VARIABLE,
                        importName,
                        filePath,
                        null,
                        null
                ));

                relationships.add(new CodeRelationship(
                        fileId,
                        CodeRelationship.RelationshipType.IMPORTS,
                        importId
                ));
            }

            for (TypeDeclaration<?> type : unit.getTypes()) {
                if (!(type instanceof ClassOrInterfaceDeclaration declaration)) {
                    continue;
                }

                String typeName = declaration.getNameAsString();
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

                typeIds.put(filePath + ":" + typeName, typeId);

                relationships.add(new CodeRelationship(
                        fileId,
                        CodeRelationship.RelationshipType.CONTAINS,
                        typeId
                ));

                declaration.getExtendedTypes().forEach(parent ->
                        relationships.add(new CodeRelationship(
                                typeId,
                                CodeRelationship.RelationshipType.EXTENDS,
                                "type-name:" + parent.getNameAsString()
                        ))
                );

                declaration.getImplementedTypes().forEach(parent ->
                        relationships.add(new CodeRelationship(
                                typeId,
                                CodeRelationship.RelationshipType.IMPLEMENTS,
                                "type-name:" + parent.getNameAsString()
                        ))
                );

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
                    String methodId = "method:" + filePath + ":"
                            + typeName + ":" + methodName + ":"
                            + method.getParameters().size();

                    nodes.add(new CodeNode(
                            methodId,
                            CodeNode.NodeType.METHOD,
                            methodName,
                            filePath,
                            method.getBegin().map(p -> p.line).orElse(null),
                            method.getEnd().map(p -> p.line).orElse(null)
                    ));

                    methodIds.put(filePath + ":" + typeName + ":" + methodName,
                            methodId);

                    relationships.add(new CodeRelationship(
                            typeId,
                            CodeRelationship.RelationshipType.CONTAINS,
                            methodId
                    ));

                    method.findAll(MethodCallExpr.class).forEach(call -> {
                        relationships.add(new CodeRelationship(
                                methodId,
                                CodeRelationship.RelationshipType.CALLS,
                                "method-name:" + call.getNameAsString()
                        ));
                    });
                }
            }
        }

        return new CodeGraph(nodes, relationships);
    }
}
