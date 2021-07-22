/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
package it.geosolutions.mapstore;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Optional;
import java.util.Properties;
import java.util.function.Consumer;
import java.util.function.Predicate;
import java.util.stream.Stream;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.servlet.HandlerMapping;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.fge.jsonpatch.JsonPatch;
import com.github.fge.jsonpatch.JsonPatchException;

import eu.medsea.mimeutil.MimeType;
import eu.medsea.mimeutil.MimeUtil;
import it.geosolutions.mapstore.utils.ResourceUtils;
import it.geosolutions.mapstore.utils.Resource;

public class ResourceProvider {
    private ObjectMapper jsonMapper = new ObjectMapper();

    @Autowired
    private ServletContext context;
    @Value("${datadir.location:}") private String dataDir = "";

    private Resource readResource(String resourceName, boolean applyOverrides, String patchName) throws IOException {
        Optional<File> resource = ResourceUtils.findResource(dataDir, context, resourceName);
        Optional<File> resourcePatch = patchName.isEmpty() ? Optional.empty()
                : ResourceUtils.findResource(dataDir, context, patchName);
        if (!resource.isPresent()) {
            throw new ResourceNotFoundException(resourceName);
        }
        return readResourceFromFile(resource.get(), applyOverrides, resourcePatch);
    }

    private Resource readResourceFromFile(File file, boolean applyOverrides, Optional<File> patch) throws IOException {
        Resource resource = new Resource();
        resource.file = file;

        MimeType type = MimeUtil.getMostSpecificMimeType(MimeUtil.getMimeTypes(file));
        resource.type = type != null ? type.toString() : null;
        try (Stream<String> stream = Files.lines(Paths.get(file.getAbsolutePath()), StandardCharsets.UTF_8);) {
            Properties props = readOverrides();
            if (applyOverrides && (!"".equals(mappings) && props != null || patch.isPresent())) {
                resource.data = resourceWithPatch(stream, props, patch);
                return resource;
            }

            try {
                StringBuilder contentBuilder = new StringBuilder();
                stream.forEach(new Consumer<String>() {
                    @Override
                    public void accept(String s) {
                        contentBuilder.append(s).append("\n"); // note: this adds a new line at the end of js files too.
                    }
                });
                resource.data = contentBuilder.toString();
            } catch (Exception e) {
                // if can not read the file line by line(e.g. images) pass the file.
                resource.file = file;
            }
            return resource;
        }

    }

    private String resourceWithPatch(Stream<String> stream, Properties props, Optional<File> patch) throws IOException {
        JsonNode jsonObject = readJsonConfig(stream);
        if (patch.isPresent()) {
            jsonObject = mergeJSON(jsonObject, jsonMapper.readValue(patch.get(), JsonPatch.class));
        }
        if (!"".equals(mappings) && props != null) {

            for (String mapping : mappings.split(",")) {
                jsonObject = fillMapping(mapping, props, jsonObject);
            }
        }
        return jsonObject.toString();
    }

    /**
     * Applies the given patch to a JSON tree (orig)
     *
     * @param orig
     * @param patch
     * @return
     * @throws IOException
     */
    private JsonNode mergeJSON(JsonNode orig, JsonPatch patch) throws IOException {
        try {
            return patch.apply(orig);
        } catch (JsonPatchException e) {
            throw new IOException("Error applying patch", e);
        }
    }

    private Properties readOverrides() throws FileNotFoundException, IOException {
        if (!"".equals(overrides)) {
            Optional<File> resource = ResourceUtils.findResource(dataDir, context, overrides);
            if (resource.isPresent()) {
                try (FileReader reader = new FileReader(resource.get())) {
                    Properties props = new Properties();
                    props.load(reader);
                    return props;
                }
            }
        }
        return null;
    }

    private JsonNode readJsonConfig(Stream<String> stream) throws IOException {
        StringBuilder contentBuilder = new StringBuilder();
        stream.forEach(new Consumer<String>() {
            @Override
            public void accept(String s) {
                contentBuilder.append(s).append("\n");
            }
        });
        String json = contentBuilder.toString();
        JsonNode jsonObject = jsonMapper.readTree(json);
        return jsonObject;
    }

    private JsonNode fillMapping(String mapping, Properties props, JsonNode jsonObject) throws IOException {
        String[] parts = mapping.split("=");
        if (parts.length != 2 || parts[0].trim().isEmpty() || parts[1].trim().isEmpty()) {
            return jsonObject;
        } else {
            String path = parts[0];
            String propName = parts[1];
            String value = props.getProperty(propName, "");
            return setJsonProperty(jsonObject, path.split("\\."), value);
        }
    }

    private JsonNode setJsonProperty(JsonNode jsonObject, String[] path, String value) throws IOException {
        String propertyPath = "/" + StringUtils.join(path, "/");
        JsonPatch patch = jsonMapper.readValue(
                "[{\"op\":\"replace\",\"path\":\"" + propertyPath + "\",\"value\":\"" + value + "\"}]",
                JsonPatch.class);
        try {
            return mergeJSON(jsonObject, patch);
        } catch (IOException e) {
            // if the property cannot be set, we ignore it
            return jsonObject;
        }
    }



    public void setContext(ServletContext context) {
        this.context = context;
    }

    public void setDataDir(String dataDir) {
        this.dataDir = dataDir;
    }

    public void setMappings(String mappings) {
        this.mappings = mappings;
    }

    public void setOverrides(String overrides) {
        this.overrides = overrides;
    }
}
