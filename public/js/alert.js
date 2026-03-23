function showAlert(type, message) {

    Swal.fire({
        icon: type,
        title: type === "success" ? "Success" : "Error",
        text: message,
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });

}