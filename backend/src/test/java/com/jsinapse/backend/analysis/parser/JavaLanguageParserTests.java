package com.jsinapse.backend.analysis.parser;

import com.jsinapse.backend.analysis.model.CodeGraph;
import com.jsinapse.backend.analysis.model.CodeNode;
import com.jsinapse.backend.analysis.model.CodeRelationship;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JavaLanguageParserTests {

    private final JavaLanguageParser parser = new JavaLanguageParser();

    @Test
    void resolvesOverloadedMethodsByArgumentType() {
        Map<String, String> files = Map.of(
                "src/OverloadDemo.java",
                """
                class OverloadDemo {
                    void process(String value) {}
                    void process(int value) {}
                    void run() {
                        process("hello");
                        process(42);
                    }
                }
                """
        );

        CodeGraph graph = parser.parse(files);
        Set<String> calls = callsFrom(graph,
                "method:src/OverloadDemo.java:OverloadDemo:run()");

        assertEquals(Set.of(
                "method:src/OverloadDemo.java:OverloadDemo:process(String)",
                "method:src/OverloadDemo.java:OverloadDemo:process(int)"
        ), calls);
    }

    @Test
    void resolvesConstructorCallsByArgumentType() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("src/BankAccount.java", """
                class BankAccount {
                    BankAccount(String name, double balance) {}
                    BankAccount(int accountNumber) {}
                }
                """);
        files.put("src/App.java", """
                class App {
                    void run() {
                        new BankAccount("Alex", 100.0);
                        new BankAccount(42);
                    }
                }
                """);

        CodeGraph graph = parser.parse(files);
        Set<String> calls = callsFrom(graph, "method:src/App.java:App:run()");

        assertEquals(Set.of(
                "constructor:src/BankAccount.java:BankAccount:String,double",
                "constructor:src/BankAccount.java:BankAccount:int"
        ), calls);
    }

    @Test
    void createsInheritanceAndImplementationRelationships() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("src/Worker.java", "interface Worker { void work(); }");
        files.put("src/Person.java", "class Person {}");
        files.put("src/Employee.java", "class Employee extends Person implements Worker { public void work() {} }");

        CodeGraph graph = parser.parse(files);
        Set<String> relationships = graph.relationships().stream()
                .map(edge -> edge.sourceId() + "|" + edge.type() + "|" + edge.targetId())
                .collect(Collectors.toSet());

        assertTrue(relationships.contains(
                "type:src/Employee.java:Employee|EXTENDS|type:src/Person.java:Person"));
        assertTrue(relationships.contains(
                "type:src/Employee.java:Employee|IMPLEMENTS|type:src/Worker.java:Worker"));
    }

    @Test
    void createsStableMethodNodesWithSourceLocations() {
        CodeGraph graph = parser.parse(Map.of(
                "src/Sample.java", "class Sample { void run() {} }"
        ));

        CodeNode method = graph.nodes().stream()
                .filter(node -> node.id().equals("method:src/Sample.java:Sample:run()"))
                .findFirst()
                .orElseThrow();

        assertEquals(CodeNode.NodeType.METHOD, method.type());
        assertEquals("run", method.name());
        assertEquals("src/Sample.java", method.filePath());
        assertEquals(1, method.startLine());
    }


    @Test
    void resolvesUnqualifiedCallsToInheritedMethods() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("src/Child.java", "class Child extends Parent { void run() { work(); } }");
        files.put("src/Parent.java", "class Parent { void work() {} }");

        CodeGraph graph = parser.parse(files);
        Set<String> calls = callsFrom(graph, "method:src/Child.java:Child:run()");

        assertEquals(Set.of("method:src/Parent.java:Parent:work()"), calls);
    }

    @Test
    void resolvesSuperCallsToParentImplementation() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("src/Child.java", """
                class Child extends Parent {
                    @Override void work() {}
                    void run() { super.work(); }
                }
                """);
        files.put("src/Parent.java", "class Parent { void work() {} }");

        CodeGraph graph = parser.parse(files);
        Set<String> calls = callsFrom(graph, "method:src/Child.java:Child:run()");

        assertEquals(Set.of("method:src/Parent.java:Parent:work()"), calls);
    }

    @Test
    void resolvesInheritedMethodsThroughMultipleLevels() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("src/Leaf.java", "class Leaf extends Middle { void run() { work(); } }");
        files.put("src/Middle.java", "class Middle extends Root {}");
        files.put("src/Root.java", "class Root { void work() {} }");

        CodeGraph graph = parser.parse(files);
        Set<String> calls = callsFrom(graph, "method:src/Leaf.java:Leaf:run()");

        assertEquals(Set.of("method:src/Root.java:Root:work()"), calls);
    }

    @Test
    void detectsMethodsOverridingInheritedMethods() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("src/Dog.java", "class Dog extends Animal { @Override void speak() {} }");
        files.put("src/Animal.java", "class Animal { void speak() {} }");

        CodeGraph graph = parser.parse(files);
        Set<String> overrides = graph.relationships().stream()
                .filter(edge -> edge.type() == CodeRelationship.RelationshipType.OVERRIDES)
                .filter(edge -> edge.sourceId().equals("method:src/Dog.java:Dog:speak()"))
                .map(CodeRelationship::targetId)
                .collect(Collectors.toSet());

        assertEquals(Set.of("method:src/Animal.java:Animal:speak()"), overrides);
    }

    @Test
    void detectsOverrideOfMethodSeveralLevelsUp() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("src/Leaf.java", "class Leaf extends Middle { @Override void work() {} }");
        files.put("src/Middle.java", "class Middle extends Root {}");
        files.put("src/Root.java", "class Root { void work() {} }");

        CodeGraph graph = parser.parse(files);
        Set<String> overrides = graph.relationships().stream()
                .filter(edge -> edge.type() == CodeRelationship.RelationshipType.OVERRIDES)
                .filter(edge -> edge.sourceId().equals("method:src/Leaf.java:Leaf:work()"))
                .map(CodeRelationship::targetId)
                .collect(Collectors.toSet());

        assertEquals(Set.of("method:src/Root.java:Root:work()"), overrides);
    }


    @Test
    void identifiesPossibleRuntimeImplementationsForPolymorphicCalls() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("src/Animal.java", "class Animal { void speak() {} }");
        files.put("src/Dog.java", "class Dog extends Animal { @Override void speak() {} }");
        files.put("src/Cat.java", "class Cat extends Animal { @Override void speak() {} }");
        files.put("src/Caller.java", "class Caller { void run(Animal animal) { animal.speak(); } }");

        CodeGraph graph = parser.parse(files);
        String callerMethod = "method:src/Caller.java:Caller:run(Animal)";

        Set<String> declaredCalls = graph.relationships().stream()
                .filter(edge -> edge.sourceId().equals(callerMethod))
                .filter(edge -> edge.type() == CodeRelationship.RelationshipType.CALLS)
                .map(CodeRelationship::targetId)
                .collect(Collectors.toSet());
        Set<String> dispatchTargets = graph.relationships().stream()
                .filter(edge -> edge.sourceId().equals(callerMethod))
                .filter(edge -> edge.type() == CodeRelationship.RelationshipType.DISPATCHES_TO)
                .map(CodeRelationship::targetId)
                .collect(Collectors.toSet());

        assertEquals(Set.of("method:src/Animal.java:Animal:speak()"), declaredCalls);
        assertEquals(Set.of(
                "method:src/Dog.java:Dog:speak()",
                "method:src/Cat.java:Cat:speak()"
        ), dispatchTargets);
    }

    @Test
    void findsPolymorphicImplementationsOfInterfaceMethods() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("src/Speaker.java", "interface Speaker { void speak(); }");
        files.put("src/Dog.java", "class Dog implements Speaker { public void speak() {} }");
        files.put("src/Caller.java", "class Caller { void run(Speaker speaker) { speaker.speak(); } }");

        CodeGraph graph = parser.parse(files);
        Set<String> dispatchTargets = graph.relationships().stream()
                .filter(edge -> edge.sourceId().equals("method:src/Caller.java:Caller:run(Speaker)"))
                .filter(edge -> edge.type() == CodeRelationship.RelationshipType.DISPATCHES_TO)
                .map(CodeRelationship::targetId)
                .collect(Collectors.toSet());

        assertEquals(Set.of("method:src/Dog.java:Dog:speak()"), dispatchTargets);
    }

    private Set<String> callsFrom(CodeGraph graph, String sourceId) {
        return graph.relationships().stream()
                .filter(edge -> edge.sourceId().equals(sourceId))
                .filter(edge -> edge.type() == CodeRelationship.RelationshipType.CALLS)
                .map(CodeRelationship::targetId)
                .collect(Collectors.toSet());
    }
}
