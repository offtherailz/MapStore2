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

/**
 * REST service for configuration files usage.
 * Allows loading configuration files from an external source (a folder outside of the webserver).
 * Can be configured using the following properties:
 *  - datadir.location absolute path of a folder where configuration files are fetched from (default: empty)
 *  - allowed.resources comma delimited list of configuration files that can be loaded using this service (whitelist),
 *    (default: localConfig, pluginsConfig, extensions) - do not specify the json extension
 *  - overrides.config: optional properties file path where overrides for the base config file are stored (default: empty)
 *  - overrides.mappings: optional list of mappings from the override configuration files, to the configuration files properties (default: empty)
 *    format: <json_path>=<propertyName>,...,<json_path>=<propertyName>
 *    example: header.height=headerHeight,header.url=headerUrl
 *
 * The overrides technique allows to take some values to insert in the config json from a simple Java properties file.
 *
 */
@Controller
public class ConfigController {


    static {
    	MimeUtil.registerMimeDetector("eu.medsea.mimeutil.detector.ExtensionMimeDetector");
    }


    @ResponseStatus(value = HttpStatus.NOT_FOUND)
    public class ResourceNotFoundException extends RuntimeException {
        public ResourceNotFoundException(String message) {
            super(message);
        }
    }

    @ResponseStatus(value = HttpStatus.FORBIDDEN)
    public class ResourceNotAllowedException extends RuntimeException {
        public ResourceNotAllowedException(String message) {
            super(message);
        }
    }

    @Value("${datadir.location:}") private String dataDir = "";
    @Value("${allowed.resources:localConfig,pluginsConfig,extensions,config,new}") private String allowedResources = "localConfig,pluginsConfig,extensions,config,new";
    @Value("${overrides.mappings:}") private String mappings;
    @Value("${overrides.config:}") private String overrides = "";

    @Autowired
    private ServletContext context;

    /**
     * Loads the resource, from the configured location (datadir or web root).
     * Both locations are tested and the resource is returned from the first location found.
     * The resource name should be in the allowed.resources list.
     *
     * It is also possible to store in datadir files in the json-patch format (with a .json.patch extension)
     * so that the final resource is built merging a static configuration with a patch.
     *
     * @param {String} resourceName name of the resource to load (e.g. localConfig)
     * @param {boolean} overrides apply overrides from the configured properties file (if any)
     */
    @RequestMapping(value="/load/{resource}", method = RequestMethod.GET)
    public @ResponseBody byte[] loadResource(@PathVariable("resource") String resourceName, @RequestParam(value="overrides", defaultValue="true") boolean applyOverrides) throws IOException {
        if (isAllowed(resourceName)) {
            return toBytes(readResource(resourceName + ".json", applyOverrides, resourceName + ".json.patch"));
        }
        throw new ResourceNotAllowedException("Resource is not allowed");
    }
    /**
    * Loads an asset from the datadir, if defined, from the webapp root folder otherwise.
    * Allows loading externalized assets (javascript bundles, translation files, and so on.
    * @param resourcePath path of the asset to load
    */
   public byte[] loadAsset(String resourcePath) throws IOException {
		return toBytes(readResource(resourcePath, false, ""));
   }
   private Resource readResource(String resourceName, boolean applyOverrides, String patchName) throws IOException {
        resourceProvider.readResource();
   }

    /**
     * Loads an asset from the datadir, if defined, from the webapp root folder otherwise.
     * Allows loading externalized assets (javascript bundles, translation files, and so on).
     * The rest of the URL from /loadasset/ is intended to be the path to resource.
     */
    @RequestMapping(value="/loadasset/**", method = RequestMethod.GET)
    public void loadAsset(HttpServletRequest request, HttpServletResponse response) throws IOException {
    	String resourcePath = ((String) request.getAttribute(
    	        HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE)).split("/loadasset/")[0];
    	if (Paths.get(resourcePath).isAbsolute()) {
    		throw new IOException("Absolute paths are not allowed!");
    	}
        Resource resource = readResource(resourcePath, false, "");
        response.setContentType(resource.type);
        IOUtils.copy(toStream(resource), response.getOutputStream());
    }
    private InputStream toStream(Resource resource) throws IOException {
    	 // data has been processed (read in UTF-8, must be converted again)
        if(resource.data != null) {
        	// check mime type
        	byte[] bytes = toBytes(resource);
        	InputStream in = new ByteArrayInputStream(bytes);
            return in;
        } else if(resource.file != null) {
        	return new FileInputStream(resource.file);
        }
        return null;

    }
    private byte[] toBytes(Resource resource) throws UnsupportedEncodingException {
    	return resource.data.getBytes("UTF-8");
    }

    private boolean isAllowed(String resourceName) {
        return Stream.of(allowedResources.split(",")).anyMatch(new Predicate<String>() {
            @Override
            public boolean test(String p) {
                return p.equals(resourceName);
            }

        });
    }
}
