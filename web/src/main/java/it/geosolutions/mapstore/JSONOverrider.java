package it.geosolutions.mapstore;


import java.io.IOException;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletResponse;

import org.json.JSONObject;

import jdk.nashorn.internal.parser.JSONParser;

public class JSONOverrider implements Filter {

    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
       
    	ResponseWrapper responseWrapper = new ResponseWrapper((HttpServletResponse) response);

	    chain.doFilter(request, responseWrapper);

	    String responseContent = new String(responseWrapper.getDataStream());
	    JSONObject json = null;
	    try {
	    	json = new JSONObject(responseContent);
	    	json.put("test", "TEST_VALUE");
	    	response.getOutputStream().write(json.toString().getBytes());
	    } catch (Exception e) {
	    	// return response as it is
	    	response.getOutputStream().write(responseContent.getBytes());
		}
	    

        
    }

    public void init(FilterConfig filterConfig) {
    }

    public void destroy() {
    }

}
