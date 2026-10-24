// Generate owned fixed-layout KF8 containers with an independent, pinned writer.
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/behringer24/mobi"
	"github.com/behringer24/mobi/records"
	"github.com/behringer24/mobi/types"
	"golang.org/x/text/language"
)

func main() {
	output := os.Args[1]
	if err := os.MkdirAll(output, 0755); err != nil {
		panic(err)
	}
	picture := image.NewRGBA(image.Rect(0, 0, 240, 320))
	for y := 0; y < 320; y++ {
		for x := 0; x < 240; x++ {
			picture.SetRGBA(x, y, color.RGBA{R: uint8(30 + x/2), G: uint8(40 + y/3), B: 140, A: 255})
		}
	}
	bodies := []string{
		"<!--" + strings.Repeat("source-padding ", 600) + "-->" +
			`<p id="first">第一页：甲😀乙 &amp; é。</p><img id="art" src="kindle:embed:0001?mime=image/jpeg" width="200" height="240"/>`,
		`<img id="whole-image" src="kindle:embed:0001?mime=image/jpeg" width="480" height="640"/>`,
		`<p id="last">末页：結び𠮷。</p><p><a href="#last">内部链接</a></p>`,
	}
	chapters := make([]mobi.Chapter, len(bodies))
	for i, body := range bodies {
		chapters[i] = mobi.Chapter{Title: fmt.Sprintf("Page %d", i+1), Chunks: []mobi.Chunk{{Body: body}}}
	}
	css := `html,body{margin:0;width:480px;height:640px;}body{position:relative;background:white;color:black;}p{position:absolute;left:20px;top:20px;margin:0;font-size:18px;line-height:24px;}#art{position:absolute;left:20px;top:80px;}#whole-image{display:block;}a{display:none;}`
	type Spec struct {
		Name        string
		Compress    bool
		Resolution  string
		RightToLeft bool
	}
	specs := []Spec{
		{Name: "fixed-plain.azw3", Resolution: "480x640"},
		{Name: "fixed-palmdoc.azw3", Compress: true, Resolution: "480x640"},
		{Name: "fixed-rtl.azw3", Compress: true, Resolution: "480x640", RightToLeft: true},
		{Name: "fixed-missing-viewport.azw3"},
		{Name: "fixed-zero-viewport.azw3", Resolution: "0x640"},
	}
	results := make([]map[string]any, 0, len(specs))
	for _, spec := range specs {
		book := mobi.Book{
			Title: "Kana fixed KF8 proof", Authors: []string{"Kisaki verification"},
			CreatedDate: time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC),
			Language: language.Japanese, FixedLayout: true, RightToLeft: spec.RightToLeft,
			Chapters: chapters, CSSFlows: []string{css}, Images: []image.Image{picture},
			UniqueID: 0x4b414e41, Compress: spec.Compress,
		}
		database := book.Realize()
		header, ok := database.Records[0].(records.NullRecord)
		if !ok {
			panic("The writer did not return the expected KF8 header.")
		}
		header.EXTHSection.AddString(types.EXTHOrigResolution, spec.Resolution)
		header.EXTHSection.AddString(types.EXTHBookType, "comic")
		database.ReplaceRecord(0, header)
		file, err := os.Create(filepath.Join(output, spec.Name))
		if err != nil {
			panic(err)
		}
		if err = database.Write(file); err != nil {
			panic(err)
		}
		if err = file.Close(); err != nil {
			panic(err)
		}
		payload, err := os.ReadFile(filepath.Join(output, spec.Name))
		if err != nil {
			panic(err)
		}
		sum := sha256.Sum256(payload)
		results = append(results, map[string]any{
			"name": spec.Name, "bytes": len(payload), "sha256": hex.EncodeToString(sum[:]),
			"compressed": spec.Compress, "resolution": spec.Resolution,
			"rightToLeft": spec.RightToLeft, "pages": len(chapters),
		})
	}
	result := map[string]any{
		"files": results, "sourceBodies": bodies, "css": css,
		"imageWidth": 240, "imageHeight": 320, "origin": "owned content; independent Go KF8 writer",
	}
	payload, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		panic(err)
	}
	if err = os.WriteFile(filepath.Join(output, "expected.json"), append(payload, '\n'), 0644); err != nil {
		panic(err)
	}
	fmt.Printf("{\"generated\":%d}\n", len(specs))
}
