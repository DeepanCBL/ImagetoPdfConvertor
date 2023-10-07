import { LightningElement, api } from "lwc";

import saveTheChunkFile from "@salesforce/apex/FileUploadService.saveTheChunkFile";

import { ShowToastEvent } from "lightning/platformShowToastEvent";

import PDF_LIB from "@salesforce/resourceUrl/pdflib";

import { loadScript } from "lightning/platformResourceLoader";

const MAX_FILE_SIZE = 4500000;

const CHUNK_SIZE = 750000;

export default class ConvertImagetoPDF extends LightningElement {
  @api recordId;

  fileName = "";

  filesUploaded = [];

  isLoading = false;
  
  fileSize;

  filetype;

  renderedCallback() {
    loadScript(this, PDF_LIB).then(() => {});
  }

  handleFilesChange(event) {
    if (event.target.files != null) {
      this.processFilesToConvert(event.target.files);
    }
  }
  
  async processFilesToConvert(files) {
    if (files.length > 0) {
      const pdfDoc = await PDFLib.PDFDocument.create();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileType = file.type;

        if (fileType === "image/png" || fileType === "image/jpeg") {
          await this.embedImageFileToPDF(pdfDoc, file);
        }
      }
      
      const pdfBytes = await pdfDoc.save();
      this.prepareFileToUpload(pdfBytes);
    }
  }
  
  async embedImageFileToPDF(pdfDoc, file) {
    const base64Data = await this.readFileAsBase64(file);

    const image = file.type === "image/png"
      ? await pdfDoc.embedPng(base64Data)
      : await pdfDoc.embedJpg(base64Data);
 

    const page = pdfDoc.addPage([800, 800]);
    page.drawImage(image, {
      x: 0,
      y: page.getHeight() - image.height,
      width: image.width,
      height: image.height
    });

  }

  async readFileAsBase64(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result.split(',')[1]);
      reader.readAsDataURL(file);
    });

  }
  
  prepareFileToUpload(pdfBytes) {
    var blob = new Blob([pdfBytes], { type: "application/pdf" });

    this.fileSize = this.formatBytes(blob.size, 2);

    if (blob.size > MAX_FILE_SIZE) {
      let message =
        "File size cannot exceed " +
        MAX_FILE_SIZE +
        " bytes.\n" +
        "Selected file size: " +
        blob.size;
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Error",
          message: message,
          variant: "error"
        })
      );
      return;
    }

    var reader = new FileReader();
    var self = this;
    reader.onload = function () {
      var fileContents = reader.result;
      var base64Mark = "base64,";
      var dataStart = fileContents.indexOf(base64Mark) + base64Mark.length;
      fileContents = fileContents.substring(dataStart);
      if (self.filetype != "application/pdf") self.upload(blob, fileContents);
      else self.upload(blob, pdfBytes);
    };
    reader.readAsDataURL(blob);
  
  }
  
  upload(file, fileContents) {
    var fromPos = 0;
    var toPos = Math.min(fileContents.length, fromPos + CHUNK_SIZE);

    this.uploadChunk(file, fileContents, fromPos, toPos, "");
 
  }

  uploadChunk(file, fileContents, fromPos, toPos, attachId) {
    this.isLoading = true;
    var chunk = fileContents.substring(fromPos, toPos);

    saveTheChunkFile({
      parentId: this.recordId,
      fileName: file.name,
      base64Data: encodeURIComponent(chunk),
      contentType: file.type,
      fileId: attachId
    })
      .then((result) => {
        attachId = result;
        fromPos = toPos;
        toPos = Math.min(fileContents.length, fromPos + CHUNK_SIZE);
        if (fromPos < toPos) {
          this.uploadChunk(file, fileContents, fromPos, toPos, attachId);
        } else {
          this.dispatchEvent(
            new ShowToastEvent({
              title: "Success!",
              message: "File Upload Success",
              variant: "success"
            })
          );
          this.isLoading = false;
        }
      })
      .catch((error) => {
        console.error("Error: ", error);
      })
      .finally(() => {});
  }
 
  
  formatBytes(bytes, decimals) {
    if (bytes == 0) return "0 Bytes";
    var k = 1024,
      dm = decimals || 2,
      sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
      i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }
}