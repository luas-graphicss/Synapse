'use strict';
(function synapseRelayUrlPresentation() {
	                                                                    
	                                                                   
	                                                                      
	                                                                         
	const hiddenHostLabel = 'synapse-mcp';

	function defaultRelayHost() {
		const endpoint = window.SynapseRelayDefaultEndpoint;
		return endpoint ? endpoint.defaultRelayHost() : '';
	}

	function defaultRelayOrigin() {
		const endpoint = window.SynapseRelayDefaultEndpoint;
		return endpoint ? endpoint.defaultRelayOrigin() : '';
	}

	function withoutTrailingSlashes(text) {
		return String(text || '').replace(/\/+$/, '');
	}

	function isDefaultRelay(text) {
		const origin = defaultRelayOrigin();
		return !!origin && withoutTrailingSlashes(text) === origin;
	}

	                                                                    
	function maskRelayHost(text) {
		const host = defaultRelayHost();
		const value = String(text || '');
		if (!host) return value;
		return value.split(host).join(hiddenHostLabel);
	}

	                                                                       
	                                                                       
	function connectorUrl(text) {
		let value = String(text || '').trim();
		if (!value) return '';
		                                                                    
		const host = defaultRelayHost();
		if (host) {
			value = value
				.split('://' + hiddenHostLabel + '/')
				.join('://' + host + '/')
				.split('://relay-oculto/')
				.join('://' + host + '/');
			if (value === '://' + hiddenHostLabel || value === 'https://' + hiddenHostLabel) {
				value = 'https://' + host;
			}
		}
		if (!/^[a-z]+:\/\//i.test(value)) value = 'https://' + value.replace(/^\/+/, '');
		try {
			const parsed = new URL(value);
			if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
			if (!parsed.hostname) return '';
			parsed.username = '';
			parsed.password = '';
			parsed.hash = '';
			return parsed.origin + parsed.pathname.replace(/\/+$/, '') + parsed.search;
		} catch (error) {
			return '';
		}
	}

	function editableRelayValue(text) {
		return isDefaultRelay(text) ? '' : String(text || '');
	}

	window.SynapseRelayUrlPresentation = Object.freeze({
		hiddenHostLabel: hiddenHostLabel,
		isDefaultRelay: isDefaultRelay,
		maskRelayHost: maskRelayHost,
		connectorUrl: connectorUrl,
		editableRelayValue: editableRelayValue,
	});
})();
