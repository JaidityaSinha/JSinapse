
package com.jsinapse.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CodeSearchServiceTest {

    private GitHubService gitHubService;
    private CodeSearchService codeSearchService;

    @BeforeEach
    void setUp() {
        gitHubService = mock(GitHubService.class);
        codeSearchService = new CodeSearchService(gitHubService);

        when(gitHubService.getDefaultBranch("owner", "repo"))
                .thenReturn("main");

        when(gitHubService.getSourceFiles("owner", "repo", "main"))
                .thenReturn(List.of(
                        file("src/Person.java"),
                        file("src/Owner.java"),
                        file("README.md")
                ));

        when(gitHubService.getFileContent("owner", "repo", "src/Person.java"))
                .thenReturn("public class Person {\n    String name;\n}");
        when(gitHubService.getFileContent("owner", "repo", "src/Owner.java"))
                .thenReturn("public class Owner {\n    Person person;\n}");
        when(gitHubService.getFileContent("owner", "repo", "README.md"))
                .thenReturn("Person project");
    }

    @Test
    void findsMatchesAndReportsCorrectLineNumbers() {
        Map<String, Object> result = codeSearchService.search(
                "owner", "repo", "Person", true, null
        );

        List<?> matches = (List<?>) result.get("matches");

        assertEquals(3, matches.size());
        assertEquals(3, result.get("matchCount"));

        Map<?, ?> firstMatch = (Map<?, ?>) matches.get(0);
        assertEquals("src/Person.java", firstMatch.get("path"));
        assertEquals(1, firstMatch.get("lineNumber"));
    }

    @Test
    void searchCanIgnoreCase() {
        Map<String, Object> result = codeSearchService.search(
                "owner", "repo", "person", false, ".java"
        );

        assertEquals(2, result.get("matchCount"));
    }

    @Test
    void caseSensitiveSearchRespectsCapitalization() {
        Map<String, Object> result = codeSearchService.search(
                "owner", "repo", "person", true, ".java"
        );

        assertEquals(1, result.get("matchCount"));
    }

    @Test
    void extensionFilterExcludesOtherFiles() {
        Map<String, Object> result = codeSearchService.search(
                "owner", "repo", "Person", true, ".java"
        );

        assertEquals(2, result.get("matchCount"));
    }

    @Test
    void rejectsBlankQueries() {
        assertThrows(
                IllegalArgumentException.class,
                () -> codeSearchService.search(
                        "owner", "repo", "  ", false, null
                )
        );
    }

    @Test
    void rejectsQueriesLongerThanLimit() {
        String query = "a".repeat(201);

        assertThrows(
                IllegalArgumentException.class,
                () -> codeSearchService.search(
                        "owner", "repo", query, false, null
                )
        );
    }

    private Map<String, Object> file(String path) {
        Map<String, Object> file = new HashMap<>();
        file.put("path", path);
        return file;
    }
}
