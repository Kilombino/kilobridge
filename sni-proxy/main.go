// lnd-sni-proxy lets a gRPC client that dials an LND by IP reach one that only
// serves its real certificate to clients that name it (SNI): an LND with
// tlsencryptkey keeps answering nameless clients with its short-lived
// ephemeral certificate. The proxy terminates TLS with its own certificate and
// dials the LND naming it, trusting only the LND's own certificate.
package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"flag"
	"io"
	"log"
	"math/big"
	"net"
	"os"
	"sync"
	"time"
)

func main() {
	listen := flag.String("listen", "", "where the proxy listens, as host:port (e.g. the Docker bridge gateway the bridge's lnd can reach)")
	upstream := flag.String("upstream", "", "the SHA256 lnd's gRPC address, as host:port")
	name := flag.String("name", "localhost", "the name sent to the LND (SNI and verification)")
	upCert := flag.String("upstream-cert", "", "the LND's tls.cert: the only certificate trusted upstream")
	certOut := flag.String("cert", "", "the proxy's own certificate (made on first start)")
	keyOut := flag.String("key", "", "the proxy's own key (made on first start)")
	flag.Parse()
	if *listen == "" || *upstream == "" || *upCert == "" || *certOut == "" || *keyOut == "" {
		log.Fatal("-listen, -upstream, -upstream-cert, -cert and -key are all required")
	}

	pemBytes, err := os.ReadFile(*upCert)
	if err != nil {
		log.Fatalf("reading the upstream certificate: %v", err)
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(pemBytes) {
		log.Fatal("the upstream certificate is not PEM")
	}
	upTLS := &tls.Config{ServerName: *name, RootCAs: pool, NextProtos: []string{"h2"}, MinVersion: tls.VersionTLS12}

	own, err := loadOrMake(*certOut, *keyOut, *listen)
	if err != nil {
		log.Fatalf("own certificate: %v", err)
	}
	ln, err := tls.Listen("tcp", *listen, &tls.Config{Certificates: []tls.Certificate{own},
		NextProtos: []string{"h2"}, MinVersion: tls.VersionTLS12})
	if err != nil {
		log.Fatalf("listening: %v", err)
	}
	log.Printf("listening on %s for %s (as %q)", *listen, *upstream, *name)
	for {
		c, err := ln.Accept()
		if err != nil {
			log.Printf("accept: %v", err)
			continue
		}
		go relay(c, *upstream, upTLS)
	}
}

func relay(down net.Conn, upstream string, cfg *tls.Config) {
	defer down.Close()
	up, err := tls.DialWithDialer(&net.Dialer{Timeout: 15 * time.Second}, "tcp", upstream, cfg)
	if err != nil {
		log.Printf("dialing %s: %v", upstream, err)
		return
	}
	defer up.Close()
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); io.Copy(up, down); up.CloseWrite() }()
	go func() { defer wg.Done(); io.Copy(down, up) }()
	wg.Wait()
}

// loadOrMake reads the proxy's certificate, or makes a ten-year self-signed one
// for the listening IP the first time.
func loadOrMake(certPath, keyPath, listen string) (tls.Certificate, error) {
	if c, err := tls.LoadX509KeyPair(certPath, keyPath); err == nil {
		return c, nil
	}
	host, _, err := net.SplitHostPort(listen)
	if err != nil {
		return tls.Certificate{}, err
	}
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}
	serial, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 120))
	tmpl := &x509.Certificate{
		SerialNumber: serial, Subject: pkix.Name{CommonName: "lnd-sni-proxy"},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().AddDate(10, 0, 0),
		KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign, IsCA: true, BasicConstraintsValid: true,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		IPAddresses: []net.IP{net.ParseIP(host)}, DNSNames: []string{"localhost"},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return tls.Certificate{}, err
	}
	kb, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return tls.Certificate{}, err
	}
	if err := os.WriteFile(certPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o644); err != nil {
		return tls.Certificate{}, err
	}
	if err := os.WriteFile(keyPath, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: kb}), 0o600); err != nil {
		return tls.Certificate{}, err
	}
	return tls.LoadX509KeyPair(certPath, keyPath)
}
