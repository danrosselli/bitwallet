const electron = require('electron');
var bitcoin = require('bitcoinjs-lib');
var request = require('request');
var fs = require('fs');
const $ = require("jquery");
var QRCode = require('qrcode-svg');

// get blockchain API from https://chain.so/
var url_bitcoin = 'https://chain.so/api/v2/';

main();

/*
$('document').ready(function(){
	main();
	
});
*/

function main()
{
	
	//open links externally by default
	$(document).on('click', 'a[href^="http"]', function(event) {
		event.preventDefault();
		electron.shell.openExternal(this.href);
	});
	
	
	$('#page_overview').show();
	$('#page_send').hide();
	$('#page_receive').hide();
	$('#page_transactions').hide();
	$('#page_log').hide();
	
	$('#balance').text('0.00000000 BTC');
	$('#unconfirmed').text('0.00000000 BTC');
	$('#number_transactions').text('0');
	
	
	$('#menu_overview').on('click', function(){
		$('#page_overview').show();
		$('#page_send').hide();
		$('#page_receive').hide();
		$('#page_transactions').hide();
		$('#page_log').hide();
	});
	
	$('#menu_send').on('click', function(){
		$('#page_overview').hide();
		$('#page_send').show();
		$('#page_receive').hide();
		$('#page_transactions').hide();
		$('#page_log').hide();
	});
	
	$('#menu_receive').on('click', function(){
		$('#page_overview').hide();
		$('#page_send').hide();
		$('#page_receive').show();
		$('#page_transactions').hide();
		$('#page_log').hide();
	});
	
	$('#menu_transactions').on('click', function(){
		$('#page_overview').hide();
		$('#page_send').hide();
		$('#page_receive').hide();
		$('#page_transactions').show();
		$('#page_log').hide();
	});
	$('#menu_log').on('click', function(){
		$('#page_overview').hide();
		$('#page_send').hide();
		$('#page_receive').hide();
		$('#page_transactions').hide();
		$('#page_log').show();
	});
	
	// carrega as chaves privadas do disco
	loadKeysFromDisk(function(keys){
		for(var k of keys)
		{
			console.log(k.key);
			$("#privatekey").append('<option>'+k.key+'</option>');
		}
		bitcoinInit();
	});
	
	// botao para importar a chave privada
	$('#import').on('click', function(){
		var private_key = $('#input_importkey').val();
		var ret = addPrivateKeyToWallet(private_key);
		if (ret == 1)
			bitcoinInit();
	});
	
	// botao para gerar a chave privada
	$('#generate').on('click', function(){
		// aqui serve para gerar uma nova chave privada (open new wallet)
		var keyPair = bitcoin.ECPair.makeRandom({network: bitcoin.networks.testnet});
		var private_key = keyPair.toWIF();
		var ret = addPrivateKeyToWallet(private_key);
		if (ret == 1)
			bitcoinInit();
	});
	
	
}


function bitcoinInit()
{
	
	
	//-- testnet

	// chave privada carteira 1 => cQPZGnCH4ep5qFH73P8kxtrcVJeekH2f8c5tetiHhYdyXsz2rhoJ
	// chave publica carteira 1 => mrnUeJXVUFxy7qLTCUSXLoUWuQubtiN8X1

	// chave privada carteira 2 => cNucdiBMPByAiNn9APh5qW2thPn64uTNTqmmEZQypUEr3U9qV5nq
	// chave publica carteira 2 => mqj3ugKwgKu8jSkyKzNvZpYqtQ2UosaXix

	//-- private key structure:
	// (1 byte) A version number.
	// (32 bytes) The ECDSA private key.
	// (4 bytes) A checksum.

	// aqui serve para gerar uma nova chave privada (open new wallet)
	//var keyPair = bitcoin.ECPair.makeRandom({network: bitcoin.networks.testnet});
	
	
	// aqui abre a carteira com uma conhecida chave privada
	var privatekey = $("#privatekey option:selected").text();
	$('#current_privatekey').text(privatekey);
	var k = getKeys(privatekey);
	
	// pega os dados da carteira na primeira vez
	renderBalance(k.public_key);
	renderReceive(k.public_key);
	renderTransactions(k.public_key);
	
	// coloca m intervalo de 1 min para ficar atualizando a carteira
	setInterval(function(){
		renderBalance(k.public_key);
		renderTransactions(k.public_key);
	}, 60000);

	$('#sendBTC').on('click', function(){
		// disable button
		$(this).prop("disabled",true);
		
		var to_address = $('#sendto').val();//'mqj3ugKwgKu8jSkyKzNvZpYqtQ2UosaXix';
		var amount = $('#sendamount').val();//0.02999;
		var fee = $('#sendfee').val();//0.02999;
		sendBTC(k.key_pair, k.public_key, to_address, amount, fee, function(json){
			log('TX ID: ' + json.data.txid);
			renderBalance(k.public_key);
			renderTransactions(k.public_key);
			$('#sendamount').val('');
			// enable button
			$('#sendBTC').prop("disabled",false);
		});
	});
	
	// botao de atualizar os dados da carteira
	$('#refresh').on('click', function(){
		$(this).prop("disabled",true);
		renderBalance(k.public_key);
		renderTransactions(k.public_key);
		setTimeout(function(){ $('#refresh').prop("disabled",false); }, 10000);
	});
	
	// botao de atualizar os dados da carteira
	$('#changePrivateKey').on('click', function(){
		// aqui abre a carteira com uma conhecida chave privada
		privatekey = $("#privatekey option:selected").text();
		$('#current_privatekey').text(privatekey);
		k = getKeys(privatekey);
		
		renderBalance(k.public_key);
		renderReceive(k.public_key);
		renderTransactions(k.public_key);
		
	
	});
	
}

function addPrivateKeyToWallet(private_key)
{
	var json = [];
	$("#privatekey").append('<option>'+private_key+'</option>');
	$("#privatekey > option").each(function() {
		let obj = new Object;
		obj.key = this.text;
		json.push(obj);
	});
		
	$('#input_importkey').val('');
	console.log(json);
	// grava no disco
	saveKeysToDisk(json);
	
	// se for a primeira chave privada, inicia o bitcoin
	return json.length;
	
}

function loadKeysFromDisk(myfunction)
{
	var text = '';
	var path_keys = electron.remote.app.getPath('appData') + '/bitwallet/keys';
	
	log('path keys file: ' + path_keys);
	fs.exists(path_keys, function(exists){
	
		if (exists)
		{
			var file = fs.createReadStream(path_keys);
			
			file.on('data', function(data){
				text += data;
			});
			
			file.on('end', function(){
				console.log('read form file: ' + text);
				var json = JSON.parse(text);
				console.log(json);
				if (myfunction)
					myfunction(json);
				
			});
		}
		else
			console.log('File keys dont exist yet');
	});

}

function saveKeysToDisk(json)
{
	var path_keys = electron.remote.app.getPath('appData') + '/bitwallet/keys';
	var json_string = JSON.stringify(json);
	//var json_string = '[{"key":"cQPZGnCH4ep5qFH73P8kxtrcVJeekH2f8c5tetiHhYdyXsz2rhoJ"},{"key":"cNucdiBMPByAiNn9APh5qW2thPn64uTNTqmmEZQypUEr3U9qV5nq"}]';
	var file = fs.createWriteStream(path_keys);
	file.write(json_string);
}

function getKeys(privatekey)
{
	
	var keyPair = bitcoin.ECPair.fromWIF(privatekey, bitcoin.networks.testnet); // carteira 1
	//var keyPair = bitcoin.ECPair.fromWIF('cNucdiBMPByAiNn9APh5qW2thPn64uTNTqmmEZQypUEr3U9qV5nq', bitcoin.networks.testnet); // carteira 2
	
	// Print your private key (in WIF format)
	var private_key = keyPair.toWIF();
	log('Private Key: ' + private_key);
	
	// Print your public key address
	var public_key = keyPair.getAddress();
	log('Address (Public Key): ' + public_key);
	
	
	//var publicKeyBuffer = keyPair.getPublicKeyBuffer();
	//var publicKeyHash = bitcoin.crypto.hash160(publicKeyBuffer);
	//var address = bitcoin.address.toBase58Check(publicKeyHash, bitcoin.networks.testnet.pubKeyHash);

	// manual generation
	//log('');
	//log('Manual generation');
	//log('Public key buffer: ' + publicKeyBuffer.toString('hex'));
	//log('Public key hash: ' + publicKeyHash.toString('hex'));
	//log('Address (PKey): ' + address);
	
	return {key_pair:keyPair, private_key:private_key, public_key:public_key};
	
}

function renderBalance(public_key)
{
	getBalance(public_key, function(json){
		$('#balance').text(json.data.confirmed_balance + ' BTC');
		$('#unconfirmed').text(json.data.unconfirmed_balance + ' BTC');
	});
	
	
}

function renderReceive(public_key)
{
	// show public key in tab receive
	$('#public_key').val(public_key);
	var svg = new QRCode(public_key).svg();
	
	$('#qrcode').html(svg);
	
	
}

function renderTransactions(public_key)
{
	
	getDisplayData(public_key, function(json){
		
		$('#table_transactions tbody > tr').remove();
		
		for(var tx of json.data.txs)
		{
			var d = new Date(parseInt(tx.time)*1000);
			var outgoing = 0;
			var incoming = 0;
			var status = '';
			
			if (tx.outgoing)
				outgoing = tx.outgoing.value;
			
			if (tx.incoming)
				incoming = tx.incoming.value;
			
			var value = incoming - outgoing;
			
			if (tx.confirmations > 0)
				status = '<span class="badge badge-success">Confirmed</span>';
			else
				status = '<span class="badge badge-danger">Unconfirmed</span>';
			
			$('#table_transactions').append('<tr><td scope="row">'+d.toLocaleString()+'</td><td><a href="https://chain.so/tx/BTCTEST/'+tx.txid+'" target="_blank">'+tx.txid+'</a></td><td>'+value.toFixed(8)+'</td><td>'+status+'</td></tr>');
		}
		
		$('#number_transactions').text(json.data.txs.length);
		
	});
	
	//getReceivedValue(public_key);
	//getSpentValue(public_key);
	
	/*
	getReceivedTx(public_key, function(json){
		
		for(var tx of json.data.txs)
		{
			var d = new Date(parseInt(tx.time)*1000);
			$('#table_trans_received').append('<tr><th scope="row">'+d.toLocaleString()+'</th><td>'+tx.txid+'</td><td>'+tx.value+'</td></tr><tr>');
		}
		
	});
	
	getSpentTx(public_key, function(json){
		
		for(var tx of json.data.txs)
		{
			var d = new Date(parseInt(tx.time)*1000);
			$('#table_trans_spent').append('<tr><th scope="row">'+d.toLocaleString()+'</th><td>'+tx.txid+'</td><td>'+tx.value+'</td></tr><tr>');
		}
		
	});
	*/
	
}


function getBalance(address, myfunction)
{
	
	//-- mostra o saldo daquele endereco
	url = url_bitcoin + 'get_address_balance/BTCTEST/' + address;
	//log('GET ' + url);

	request(url, function (error, response, body) {
		
		console.log('-----------------------------------');
		console.log('Show balance');
		console.log('status code: ' + response.statusCode);
		//console.log('body ' + body);
			
		if (!error && response.statusCode == 200)
		{
			
			var json = JSON.parse(body);
			
			if (myfunction)
				myfunction(json);
			
		}
		else
		{
			console.log('erro na consulta: ' + error);
		}
		
		
	});
	
}

// funcao para mostrar o historico de transacoes para um determinado endereco
function getDisplayData(address, myfunction)
{
	//-- mostra o saldo daquele endereco
	url = url_bitcoin + 'address/BTCTEST/' + address;
	//log('GET ' + url);

	request(url, function (error, response, body) {
		
		console.log('-----------------------------------');
		console.log('Show address data');
		console.log('status code: ' + response.statusCode);
		//console.log('body ' + body);
			
		if (!error && response.statusCode == 200)
		{
			
			var json = JSON.parse(body);
			if (myfunction)
				myfunction(json);
			
		}
		else
		{
			console.log('erro na consulta: ' + error);
		}
		
		
	});
	
}


function getReceivedValue(address, myfunction)
{
	//-- mostra o saldo daquele endereco
	url = url_bitcoin + 'get_address_received/BTCTEST/' + address;
	//log('GET ' + url);

	request(url, function (error, response, body) {
		
		console.log('-----------------------------------');
		console.log('Show received value');
		console.log('status code: ' + response.statusCode);
		console.log('body ' + body);
			
		if (!error && response.statusCode == 200)
		{
			var json = JSON.parse(body);
			if (myfunction)
				myfunction(json);
		}
		else
		{
			console.log('erro na consulta: ' + error);
		}
		
		
	});
	
}


function getSpentValue(address, myfunction)
{
	//-- mostra o saldo daquele endereco
	url = url_bitcoin + 'get_address_spent/BTCTEST/' + address;
	//log('GET ' + url);

	request(url, function (error, response, body) {
		
		console.log('-----------------------------------');
		console.log('Show spent value');
		console.log('status code: ' + response.statusCode);
		console.log('body ' + body);
			
		if (!error && response.statusCode == 200)
		{
			
			var json = JSON.parse(body);
			if (myfunction)
				myfunction(json);
			
		}
		else
		{
			console.log('erro na consulta: ' + error);
		}
		
		
	});
	
}


function getReceivedTx(address, myfunction)
{
	//-- mostra o saldo daquele endereco
	url = url_bitcoin + 'get_tx_received/BTCTEST/' + address;
	//log('GET ' + url);

	request(url, function (error, response, body) {
		
		console.log('-----------------------------------');
		console.log('Show received tx');
		console.log('status code: ' + response.statusCode);
		console.log('body ' + body);
			
		if (!error && response.statusCode == 200)
		{
			
			var json = JSON.parse(body);
			if (myfunction)
				myfunction(json);
			
		}
		else
		{
			console.log('erro na consulta: ' + error);
		}
		
		
	});
	
}


function getSpentTx(address, myfunction)
{
	//-- mostra o saldo daquele endereco
	url = url_bitcoin + 'get_tx_spent/BTCTEST/' + address;
	//log('GET ' + url);

	request(url, function (error, response, body) {
		
		console.log('-----------------------------------');
		console.log('Show spent tx');
		console.log('status code: ' + response.statusCode);
		console.log('body ' + body);
			
		if (!error && response.statusCode == 200)
		{
			
			var json = JSON.parse(body);
			if (myfunction)
				myfunction(json);
			
		}
		else
		{
			console.log('erro na consulta: ' + error);
		}
		
		
	});
	
}

function getUnspentTx(address, myfunction)
{
	//-- mostra o saldo daquele endereco
	url = url_bitcoin + 'get_tx_unspent/BTCTEST/' + address;
	//log('GET ' + url);

	request(url, function (error, response, body) {
		
		console.log('-----------------------------------');
		console.log('Show unspent tx');
		console.log('status code: ' + response.statusCode);
		console.log('body ' + body);
			
		if (!error && response.statusCode == 200)
		{
			
			var json = JSON.parse(body);
			if (myfunction)
				myfunction(json);
			
		}
		else
		{
			console.log('erro na consulta: ' + error);
		}
		
		
	});
	
}


function sendBTC(keyPair, from_address, to_adress, amount = 0, fee = 0.0001, myfunction)
{

	amount = parseFloat(amount);
	fee = parseFloat(fee);
	getBalance(from_address, function(json){
		
		if (amount > parseFloat(json.data.confirmed_balance))
		{
			console.log('Não tem saldo disponível para essa transação')
		}
		else
		{
			getUnspentTx(from_address, function(json){
			
				var unspent = [];
				for(var tx of json.data.txs)
				{
					// coloca as transacoes no array ate completar o valor total (amount) a ser transferido
					unspent.push({tx:tx.txid, output_no:tx.output_no, value:tx.value});
					if ((amount + fee) <= parseFloat(tx.value))
						break;
				}
				
				console.log(amount + fee);
				console.log(unspent);
				
				// faz as transacoes usando os txs que tem o valor para gastar
				makeTransaction(keyPair, unspent, from_address, to_adress, amount, fee, function(json){
					if (myfunction)
						myfunction(json);
				
				});
				
			});
			
		}
	
	});
	


}


function makeTransaction(keyPair, unspent, from_address, to_address, amount, fee = 0.0001, myfunction)
{

	console.log('Fazer a Transacao');
	
	// create the transaction
	var tx = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
	var total_input = 0;
	for(var t of unspent)
	{
		// Add the input (who is paying):
		// [previous transaction hash, index of the output to use]
		tx.addInput(t.tx, t.output_no);
		console.log('Unspent tx: ' + t.tx + ' | index number: ' + t.output_no  + ' | value: ' + t.value);
		total_input += parseFloat(t.value);	
	}
	
	var change = total_input - amount - fee;
	
	tx.addOutput(from_address, BTCToSatoshi(change)); // quantia q sobrou q eu mando pra mim de volta (menos a taxa do miner)
	tx.addOutput(to_address, BTCToSatoshi(amount)); // quantia que eu quero pagar
	
	// Sign the number of inputs with the new key
	for(var i = 0; i<unspent.length; i++)
		tx.sign(i, keyPair);
	
	// Print transaction serialized as hex
	var txHex = tx.build().toHex();

	console.log('transaction: ' + txHex);

	//logger.write(txHex + '\n');
	// => 0100000001313eb630b128102b60241ca895f1d0ffca21 ...

	// You could now push the transaction onto the Bitcoin network manually
	// para testnet (see https://tbtc.blockr.io/tx/push)
	
	pushTransaction(txHex, function(json){
		if (myfunction)
			myfunction(json);
	
	});

}

// a transacao toda vem na forma de um hash, que empurramos para o blockchain
function pushTransaction(txHex, myfunction)
{
	
	url = url_bitcoin + 'send_tx/BTCTEST';
	
	var requestData = '{"tx_hex":"' + txHex + '"}';
	
	var options = {
		uri: url,
		body: requestData,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' }
	}
            
	request(options, function (error, response, body) {
		
		console.log('-----------------------------------');
		console.log('Push transaction data to blockchain');
		
		console.log('status code: ' + response.statusCode);
		console.log('body ' + body);
			
		if (!error && response.statusCode == 200) {
			
			var json = JSON.parse(body);
			/*
			body {
			  "status" : "success",
			  "data" : {
				"network" : "BTCTEST",
				"txid" : "c97c2d0d89891558b050b7ba7258b3b098c67e976e01f80ec3a2337fe4b86ae4"
			  }
			}
			*/
			console.log('TX ID: ' + json.data.txid);
			if (myfunction)
				myfunction(json);
			
		}
		else
		{
			console.log('erro na consulta: ' + error);
		}
		

	});
	
	
	
}


// Convert 'satoshi' to bitcoin value
 function satoshiToBTC(value) {
	return value * 0.00000001;
};

// Convert bitcoin to 'satoshi' value
function BTCToSatoshi(value) {
	return Math.floor(value * 100000000);
};


function log(text)
{
	$('#log').append(text + '\r');
	

}
