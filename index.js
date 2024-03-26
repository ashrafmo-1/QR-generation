
let qrBox = document.querySelector(".imageQrBox");
let qrImage = document.querySelector(".imgQr");
let inputLink = document.querySelector(".dataInput");
let btnSubmet = document.querySelector(".generation");

const qrGenerator = () => {
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${inputLink.value}`;
}

btnSubmet.addEventListener("click", () => {
  document.querySelector(".app_box").style.height = "400px";
  qrBox.style.marginTop = "20px";
  qrGenerator();
})