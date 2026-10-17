
package com.jsinapse.backend.analysis.parser;

import com.jsinapse.backend.analysis.model.CodeGraph;

import java.util.Map;

public interface LanguageParser {

    String getLanguage();

    boolean supports(String filePath);

    CodeGraph parse(Map<String, String> sourceFiles);
}
